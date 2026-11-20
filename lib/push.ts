import webpush from "web-push";
import { db } from "./db";
import type { Mode } from "./routing";

let configured = false;
export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
function configure() {
  if (configured) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
  return true;
}

export type PushPayload = {
  kind: "ring" | "quiet" | "opened" | "info";
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
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q("UPDATE devices SET push_sub = NULL WHERE id = $1", [r.id]);
        }
      }
    }),
  );
  return { sent, skipped: rows.length - sent };
}
