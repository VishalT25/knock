import { db } from "./db";
import { getSettings } from "./config";
import { getAutoOpen } from "./autoopen";
import { diffPlan, planNotifications, shouldEscalate, type Plan, type RoutingUser } from "./routing";
import { payloadFor, pushToUsers } from "./push";
import { telephony } from "./telnyx";

export type Method = "button" | "auto" | "fallback";
export type CallStatus = "ringing" | "opening" | "opened" | "fallback" | "missed" | "failed";
export type Actor = { id: string; name: string } | null;

const d = (v: unknown) => (v ? new Date(v as string) : null);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A ringing call with no hangup webhook for this long is considered dead. */
export const STALE_AFTER_SEC = 150;

export type CallRow = {
  id: string;
  callControlId: string | null;
  status: CallStatus;
  startedAt: Date;
  escalatedAt: Date | null;
  openedAt: Date | null;
  openedByName: string | null;
  method: Method | null;
  endedAt: Date | null;
  notified: Plan;
  autoByName: string | null;
  lastError: string | null;
};

export function mapCall(r: any): CallRow {
  return {
    id: r.id,
    callControlId: r.call_control_id,
    status: r.status,
    startedAt: new Date(r.started_at),
    escalatedAt: d(r.escalated_at),
    openedAt: d(r.opened_at),
    openedByName: r.opened_by_name,
    method: r.method,
    endedAt: d(r.ended_at),
    notified: (typeof r.notified === "string" ? JSON.parse(r.notified) : r.notified) ?? {},
    autoByName: r.auto_by_name,
    lastError: r.last_error,
  };
}

export async function getCall(id: string): Promise<CallRow | null> {
  const q = await db();
  const rows = await q("SELECT * FROM calls WHERE id = $1", [id]);
  return rows[0] ? mapCall(rows[0]) : null;
}

export async function getCallByControlId(ccid: string): Promise<CallRow | null> {
  const q = await db();
  const rows = await q("SELECT * FROM calls WHERE call_control_id = $1", [ccid]);
  return rows[0] ? mapCall(rows[0]) : null;
}

export async function latestCall(): Promise<CallRow | null> {
  const q = await db();
  const rows = await q("SELECT * FROM calls ORDER BY started_at DESC LIMIT 1");
  return rows[0] ? mapCall(rows[0]) : null;
}

/** Register an incoming call (idempotent on call_control_id). */
export async function registerCall(callControlId: string): Promise<{ call: CallRow; created: boolean }> {
  const q = await db();
  const ins = await q(
    "INSERT INTO calls (call_control_id) VALUES ($1) ON CONFLICT (call_control_id) DO NOTHING RETURNING *",
    [callControlId],
  );
  if (ins[0]) return { call: mapCall(ins[0]), created: true };
  return { call: (await getCallByControlId(callControlId))!, created: false };
}

/**
 * Atomic claim. The single UPDATE ... WHERE status='ringing' is the whole lock:
 * exactly one concurrent caller gets a row back.
 */
export async function claimCall(callId: string, actor: Actor, method: Method, autoByName?: string) {
  const q = await db();
  const rows = await q(
    `UPDATE calls SET status = 'opening', claimed_at = now(), opened_by = $2, opened_by_name = $3, method = $4, auto_by_name = $5, last_error = NULL
     WHERE id = $1 AND status = 'ringing' RETURNING *`,
    [callId, actor?.id ?? null, actor?.name ?? autoByName ?? null, method, autoByName ?? null],
  );
  if (rows[0]) return { won: true as const, call: mapCall(rows[0]) };
  return { won: false as const, call: await getCall(callId) };
}

async function revertClaim(callId: string, error: string) {
  const q = await db();
  await q(
    `UPDATE calls SET status = 'ringing', claimed_at = NULL, opened_by = NULL, opened_by_name = NULL, method = NULL, auto_by_name = NULL, last_error = $2
     WHERE id = $1 AND status = 'opening'`,
    [callId, error],
  );
}

export type OpenResult =
  | { ok: true; call: CallRow }
  | { ok: false; reason: "already" | "ended" | "error"; call: CallRow | null; error?: string };

/**
 * Claim -> send DTMF -> mark opened -> hang up. `defer` lets a route run the post-DTMF hangup
 * after the response (Next's `after`); tests/lifecycle just await it.
 */
export async function openDoor(
  callId: string,
  actor: Actor,
  method: Method,
  opts: { defer?: (fn: () => Promise<void>) => void; autoByName?: string } = {},
): Promise<OpenResult> {
  const claim = await claimCall(callId, actor, method, opts.autoByName);
  if (!claim.won) {
    const c = claim.call;
    if (!c) return { ok: false, reason: "ended", call: null };
    return { ok: false, reason: c.status === "missed" ? "ended" : "already", call: c };
  }
  const settings = await getSettings();
  const tel = telephony();
  const ccid = claim.call.callControlId!;
  try {
    await tel.sendDtmf(ccid, settings.unlockDigit);
  } catch (e) {
    const msg = (e as Error).message;
    await revertClaim(callId, msg);
    return { ok: false, reason: "error", call: await getCall(callId), error: msg };
  }
  const q = await db();
  const rows = await q(
    "UPDATE calls SET status = 'opened', opened_at = now(), ended_at = now() WHERE id = $1 AND status = 'opening' RETURNING *",
    [callId],
  );
  const call = mapCall(rows[0]);
  const finish = async () => {
    await sleep(1000); // let the tone finish before dropping the line
    await tel.hangup(ccid).catch((e) => console.warn("hangup after dtmf failed", e));
  };
  if (opts.defer) opts.defer(finish);
  else await finish();

  if (actor) await q("UPDATE users SET expecting_until = NULL WHERE id = $1 AND expecting_until IS NOT NULL", [actor.id]);
  const who = actor?.name ?? opts.autoByName ?? "Someone";
  await pushToUsers(
    "all",
    {
      kind: "opened",
      title: method === "auto" ? "Door auto-opened" : `Opened by ${who}`,
      body: method === "auto" ? `Auto-open (enabled by ${opts.autoByName ?? "someone"}) let the visitor in.` : "The door is open.",
      callId,
      url: "/",
      tag: "knock-call",
    },
    "info",
  );
  return { ok: true, call };
}

/* ---------------- Notifications ---------------- */

export async function routingUsers(): Promise<RoutingUser[]> {
  const q = await db();
  const rows = await q("SELECT id, expecting_until, quiet_start, quiet_end FROM users");
  return rows.map((r) => ({ id: r.id, expectingUntil: d(r.expecting_until), quietStart: r.quiet_start, quietEnd: r.quiet_end }));
}

/** Compute who should be notified how, and send what hasn't been sent. Each send is reserved atomically. */
export async function notifyCall(callId: string, now = new Date()) {
  const call = await getCall(callId);
  if (!call || call.status !== "ringing") return;
  const settings = await getSettings();
  const users = await routingUsers();
  const plan = planNotifications({ users, now, escalated: !!call.escalatedAt, timeZone: settings.timezone });
  const todo = diffPlan(call.notified, plan);
  const q = await db();
  for (const { userId, mode } of todo) {
    const prev = call.notified[userId];
    const rows = await q(
      `UPDATE calls SET notified = jsonb_set(notified, ARRAY[$2::text], to_jsonb($3::text))
       WHERE id = $1 AND status = 'ringing' AND (notified->>$2) IS NOT DISTINCT FROM $4::text RETURNING id`,
      [callId, userId, mode, prev ?? null],
    );
    if (!rows[0]) continue; // someone else reserved it
    await pushToUsers([userId], payloadFor(mode === "loud" ? "ring" : "quiet", callId), mode);
  }
}

export async function escalate(callId: string) {
  const q = await db();
  const rows = await q("UPDATE calls SET escalated_at = now() WHERE id = $1 AND status = 'ringing' AND escalated_at IS NULL RETURNING id", [callId]);
  if (rows[0]) await notifyCall(callId);
  return !!rows[0];
}

/* ---------------- Fallback & hangup ---------------- */

export async function startFallback(callId: string) {
  const settings = await getSettings();
  if (!settings.fallbackNumber) return false;
  const q = await db();
  const rows = await q(
    "UPDATE calls SET status = 'fallback', method = 'fallback', fallback_at = now() WHERE id = $1 AND status = 'ringing' RETURNING *",
    [callId],
  );
  if (!rows[0]) return false;
  const call = mapCall(rows[0]);
  try {
    await telephony().transfer(call.callControlId!, settings.fallbackNumber);
  } catch (e) {
    await q("UPDATE calls SET status = 'ringing', method = NULL, fallback_at = NULL, last_error = $2 WHERE id = $1 AND status = 'fallback'", [callId, (e as Error).message]);
    return false;
  }
  await pushToUsers("all", { kind: "info", title: "Nobody opened the door", body: "Calling the backup number so they can open it.", callId, url: "/", tag: "knock-call" }, "info");
  return true;
}

export async function handleHangup(callControlId: string) {
  const q = await db();
  const rows = await q(
    `UPDATE calls SET ended_at = COALESCE(ended_at, now()),
       status = CASE WHEN status = 'ringing' THEN 'missed' ELSE status END
     WHERE call_control_id = $1 AND ended_at IS NULL RETURNING *, (status = 'missed') AS now_missed`,
    [callControlId],
  );
  const r = rows[0];
  if (r?.status === "missed") {
    await pushToUsers("all", { kind: "info", title: "Visitor left", body: "Nobody opened the door before they hung up.", callId: r.id, url: "/", tag: "knock-call" }, "info");
  }
  return r ? mapCall(r) : null;
}

/* ---------------- Time-based progression (idempotent) ---------------- */

export async function tick(callId: string, now = new Date()): Promise<CallRow | null> {
  let call = await getCall(callId);
  if (!call || call.status !== "ringing") return call;
  const age = (now.getTime() - call.startedAt.getTime()) / 1000;
  const settings = await getSettings();
  if (age > STALE_AFTER_SEC) {
    const q = await db();
    await q("UPDATE calls SET status = 'missed', ended_at = now() WHERE id = $1 AND status = 'ringing'", [callId]);
    return getCall(callId);
  }
  if (shouldEscalate({ startedAt: call.startedAt, now, escalateAfterSec: settings.escalateAfter, alreadyEscalated: !!call.escalatedAt })) {
    await escalate(callId);
  }
  if (age >= settings.backupTimeout && settings.fallbackNumber) {
    await startFallback(callId);
  }
  call = await getCall(callId);
  return call;
}

/**
 * Background driver for one call. Safe to run alongside client-driven ticks:
 * every step is guarded by an atomic UPDATE.
 */
export async function runLifecycle(callId: string, opts: { pollMs?: number; autoOpenDelayMs?: number } = {}) {
  const pollMs = opts.pollMs ?? 1000;
  await notifyCall(callId);

  const auto = await getAutoOpen();
  if (auto) {
    await sleep(opts.autoOpenDelayMs ?? 2000);
    const again = await getAutoOpen(); // may have been cancelled during the "one moment"
    const c = await getCall(callId);
    if (again && c?.status === "ringing") {
      await openDoor(callId, null, "auto", { autoByName: again.byName });
      return;
    }
  }

  const settings = await getSettings();
  const deadline = Date.now() + (Math.max(settings.backupTimeout, settings.escalateAfter) + 3) * 1000;
  while (Date.now() < deadline) {
    const c = await tick(callId);
    if (!c || c.status !== "ringing") return;
    await sleep(pollMs);
  }
}

export async function listLog(limit = 50) {
  const q = await db();
  const rows = await q("SELECT * FROM calls ORDER BY started_at DESC LIMIT $1", [limit]);
  return rows.map(mapCall);
}
