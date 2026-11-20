import * as webpushModule from "web-push";

// web-push is CommonJS. Depending on the bundler the API is on `.default` or on the namespace itself; take whichever exists.
const webpush: typeof import("web-push") = ((webpushModule as unknown as { default?: typeof import("web-push") }).default ?? webpushModule) as typeof import("web-push");
import { db } from "./db";
import type { Mode } from "./routing";
import { getVapid } from "./vapid-store";

let configuredFor = "";
type Ready = { ok: true; source: "env" | "generated" } | { ok: false; message: string };

/** Load the push keys (environment, or generated and stored) and hand them to the push library. */
async function configure(): Promise<Ready> {
  const v = await getVapid();
  if (!v.ok) return { ok: false, message: v.problem };
  if (configuredFor !== v.publicKey) {
    try {
      webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
      configuredFor = v.publicKey;
    } catch (e) {
      console.error("VAPID setup failed:", (e as Error).message);
      return { ok: false, message: `The push library said: ${(e as Error).message}` };
    }
  }
  return { ok: true, source: v.source };
}

export async function pushReady(): Promise<{ ok: boolean; problem: string | null }> {
  const c = await configure();
  return c.ok ? { ok: true, problem: null } : { ok: false, problem: c.message };
}

export type PushPayload = {
  kind: "ring" | "quiet" | "opened" | "info" | "test";
  title: string;
  body: string;
  callId?: string;
  url?: string;
  tag?: string;
};

export type PushSender = (sub: any, payload: PushPayload, opts: { urgency: "high" | "low" | "normal"; ttl: number }) => Promise<void>;

let sender: PushSender | null = null;
export function setPushSenderForTests(s: PushSender | null) {
  sender = s;
}
export const sentLog: { userId: string; payload: PushPayload }[] = [];

async function defaultSender(sub: any, payload: PushPayload, opts: { urgency: "high" | "low" | "normal"; ttl: number }) {
  await webpush.sendNotification(sub, JSON.stringify(payload), { urgency: opts.urgency, TTL: opts.ttl, timeout: 5000 });
}

/** One push to one subscription, with the push service's reason spelled out on failure (and logged). */
export async function sendToSubscription(sub: any, payload: PushPayload): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
  if (!sender) {
    const c = await configure();
    if (!c.ok) return { ok: false, message: `The server couldn't set up push. ${c.message} If you set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY yourself, fix them in Vercel (or delete both so Knock generates its own) and redeploy.`.replace(/\s+/g, " ") };
  }
  try {
    await (sender ?? defaultSender)(sub, payload, { urgency: "high", ttl: 60 });
    return { ok: true };
  } catch (e: any) {
    const status: number | undefined = e?.statusCode;
    const body = typeof e?.body === "string" ? e.body.slice(0, 200) : "";
    console.error("push send failed", status, body || e?.message);
    const hint =
      status === 403 || status === 401 ? "The push service rejected the server's keys. If you set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY yourself, make sure they are the matching pair. Then turn notifications off and on again on this phone."
      : status === 404 || status === 410 ? "This phone's subscription expired. Turn notifications off and on again."
      : status === 400 ? "The push service rejected the request. If you changed the push keys, turn notifications off and on again on this phone."
      : `Push failed: ${e?.message ?? "unknown error"}`;
    return { ok: false, message: `${hint}${status ? ` (HTTP ${status})` : ""}`, status };
  }
}

export function payloadFor(kind: "ring" | "quiet", callId: string): PushPayload {
  return kind === "ring"
    ? { kind: "ring", title: "Someone is at the door", body: "Tap to open the door.", callId, url: "/?open=1", tag: "knock-call" }
    : { kind: "quiet", title: "Door buzzed", body: "Someone else is being notified.", callId, url: "/?open=1", tag: "knock-call" };
}

export async function pushToUsers(userIds: string[] | "all", payload: PushPayload, mode: Mode | "info" = "info") {
  const q = await db();
  const rows =
    userIds === "all"
      ? await q("SELECT d.id, d.user_id, d.push_sub FROM devices d WHERE d.revoked_at IS NULL AND d.push_sub IS NOT NULL")
      : userIds.length === 0
        ? []
        : await q("SELECT d.id, d.user_id, d.push_sub FROM devices d WHERE d.revoked_at IS NULL AND d.push_sub IS NOT NULL AND d.user_id = ANY($1::uuid[])", [userIds]);
  if (!sender && !(await configure()).ok) {
    for (const r of rows) sentLog.push({ userId: r.user_id, payload });
    return { sent: 0, skipped: rows.length };
  }
  const send = sender ?? defaultSender;
  const opts = { urgency: mode === "loud" ? ("high" as const) : mode === "quiet" ? ("low" as const) : ("normal" as const), ttl: mode === "loud" ? 45 : 120 };
  let sent = 0;
  await Promise.all(
    rows.map(async (r) => {
      try {
        await send(r.push_sub, payload, opts);
        sentLog.push({ userId: r.user_id, payload });
        sent++;
      } catch (e: any) {
        console.error("push send failed", e?.statusCode, typeof e?.body === "string" ? e.body.slice(0, 200) : e?.message);
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q("UPDATE devices SET push_sub = NULL WHERE id = $1", [r.id]);
        }
      }
    }),
  );
  return { sent, skipped: rows.length - sent };
}
