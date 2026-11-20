import webpush from "web-push";
import { db } from "./db";
import type { Mode } from "./routing";
import { cleanKey, normalizeSubject, vapidProblem } from "./vapid";

let configured = false;
let setupError = "";
export function pushConfigured() {
  return !vapidProblem(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
function configure() {
  if (configured) return true;
  if (!pushConfigured()) return false;
  try {
    webpush.setVapidDetails(normalizeSubject(process.env.VAPID_SUBJECT), cleanKey(process.env.VAPID_PUBLIC_KEY), cleanKey(process.env.VAPID_PRIVATE_KEY));
    configured = true;
    return true;
  } catch (e) {
    setupError = (e as Error).message;
    console.error("VAPID setup failed:", setupError);
    return false;
  }
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
  if (!sender && !configure()) {
    const why = vapidProblem(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY) ?? (setupError ? `The push library said: ${setupError}` : "");
    return { ok: false, message: `The server couldn't set up push. ${why} Fix it in Vercel (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) and redeploy.`.replace(/\s+/g, " ") };
  }
  try {
    await (sender ?? defaultSender)(sub, payload, { urgency: "high", ttl: 60 });
    return { ok: true };
  } catch (e: any) {
    const status: number | undefined = e?.statusCode;
    const body = typeof e?.body === "string" ? e.body.slice(0, 200) : "";
    console.error("push send failed", status, body || e?.message);
    const hint =
      status === 403 || status === 401 ? "The push service rejected the server's keys. Make sure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel are the matching pair, then turn notifications off and on again on this phone."
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
  if (!sender && !configure()) {
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
