/**
 * Pure notification-routing logic. No I/O, fully unit-tested.
 *
 * Rules:
 *  - Expecting users (expiry in the future) are notified first; if none, everyone.
 *  - Escalation (timer or "Not mine") adds everybody else.
 *  - Quiet hours downgrade a loud notification to a quiet ping unless the user is expecting.
 *  - Everyone who is not loud gets a quiet ping.
 */
export type RoutingUser = {
  id: string;
  expectingUntil: Date | null;
  quietStart: string | null; // "HH:MM"
  quietEnd: string | null;
};
export type Mode = "loud" | "quiet";
export type Plan = Record<string, Mode>;

export function isExpecting(u: Pick<RoutingUser, "expectingUntil">, now: Date) {
  return !!u.expectingUntil && u.expectingUntil.getTime() > now.getTime();
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function localMinutes(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

/** Handles windows that wrap midnight (22:00 -> 07:00). Equal start/end = disabled. */
export function inQuietHours(
  u: Pick<RoutingUser, "quietStart" | "quietEnd">,
  now: Date,
  timeZone: string,
): boolean {
  if (!u.quietStart || !u.quietEnd) return false;
  const s = toMinutes(u.quietStart);
  const e = toMinutes(u.quietEnd);
  if (s === null || e === null || s === e) return false;
  const cur = localMinutes(now, timeZone);
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function planNotifications(args: {
  users: RoutingUser[];
  now: Date;
  escalated: boolean;
  timeZone: string;
}): Plan {
  const { users, now, escalated, timeZone } = args;
  const expecting = users.filter((u) => isExpecting(u, now));
  const first = expecting.length > 0 ? expecting : users;
  const group = new Set((escalated ? users : first).map((u) => u.id));
  const plan: Plan = {};
  for (const u of users) {
    let mode: Mode = group.has(u.id) ? "loud" : "quiet";
    if (mode === "loud" && !isExpecting(u, now) && inQuietHours(u, now, timeZone)) mode = "quiet";
    plan[u.id] = mode;
  }
  return plan;
}

/** What still needs sending, given what each user was already sent. */
export function diffPlan(prev: Plan, next: Plan): { userId: string; mode: Mode }[] {
  const out: { userId: string; mode: Mode }[] = [];
  for (const [userId, mode] of Object.entries(next)) {
    const before = prev[userId];
    // Never downgrade a loud push; upgrade quiet -> loud and first sends are sent.
    if (before === undefined || (before === "quiet" && mode === "loud")) out.push({ userId, mode });
  }
  return out;
}

/** Should the first group escalate to everyone by now? */
export function shouldEscalate(args: {
  startedAt: Date;
  now: Date;
  escalateAfterSec: number;
  alreadyEscalated: boolean;
}) {
  if (args.alreadyEscalated) return false;
  return args.now.getTime() - args.startedAt.getTime() >= args.escalateAfterSec * 1000;
}
