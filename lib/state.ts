import { db } from "./db";
import { getSettings } from "./config";
import { getAutoOpen } from "./autoopen";
import { latestCall, tick } from "./calls";
import { pushConfigured } from "./push";
import type { Me } from "./auth";

/** How long a finished call stays on the Open screen as a result. */
export const RESULT_SHOW_SEC = 45;

export async function buildState(me: Me, now = new Date()) {
  const q = await db();
  const [settings, autoOpen, userRows] = await Promise.all([
    getSettings(),
    getAutoOpen(now),
    q("SELECT expecting_until, quiet_start, quiet_end FROM users WHERE id = $1", [me.id]),
  ]);
  let call = await latestCall();
  if (call && call.status === "ringing") call = await tick(call.id, now); // client-driven redundancy
  const u = userRows[0] ?? {};
  const active = !!call && (call.status === "ringing" || call.status === "opening");
  const recent = !!call && !active && now.getTime() - (call.endedAt ?? call.startedAt).getTime() < RESULT_SHOW_SEC * 1000;
  return {
    now: now.toISOString(),
    me: {
      id: me.id,
      name: me.name,
      role: me.role,
      expectingUntil: u.expecting_until ? new Date(u.expecting_until).toISOString() : null,
      quietStart: u.quiet_start ?? null,
      quietEnd: u.quiet_end ?? null,
    },
    household: { name: settings.householdName, autoOpenMax: settings.autoOpenMax },
    pushConfigured: pushConfigured(),
    autoOpen: autoOpen ? { until: autoOpen.until.toISOString(), byName: autoOpen.byName } : null,
    call:
      call && (active || recent)
        ? {
            id: call.id,
            status: call.status,
            startedAt: call.startedAt.toISOString(),
            openedByName: call.openedByName,
            method: call.method,
            escalated: !!call.escalatedAt,
            myMode: call.notified[me.id] ?? null,
            error: call.lastError,
          }
        : null,
  };
}
export type AppState = Awaited<ReturnType<typeof buildState>>;
