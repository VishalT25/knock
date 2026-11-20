import { db } from "./db";
import { AUTO_OPEN_CHOICES, getSettings } from "./config";

export type AutoOpen = { until: Date; byId: string | null; byName: string } | null;

/** Pure: is a window active at `now`? Expiry is always judged by time, never by a stored flag. */
export function activeWindow(row: { until: Date | string | null; by?: string | null; byName?: string | null } | undefined, now: Date): AutoOpen {
  if (!row?.until) return null;
  const until = new Date(row.until);
  if (until.getTime() <= now.getTime()) return null;
  return { until, byId: row.by ?? null, byName: row.byName ?? "Someone" };
}

/** Pure: validate/clamp requested minutes. */
export function resolveMinutes(requested: number, maxMinutes: number): number | null {
  const cap = Math.min(60, maxMinutes);
  if (!(AUTO_OPEN_CHOICES as readonly number[]).includes(requested)) return null;
  if (requested > cap) return null;
  return requested;
}

export async function getAutoOpen(now = new Date()): Promise<AutoOpen> {
  const q = await db();
  const rows = await q("SELECT until, enabled_by, enabled_by_name FROM auto_open WHERE id = 1");
  const r = rows[0];
  return activeWindow(r && { until: r.until, by: r.enabled_by, byName: r.enabled_by_name }, now);
}

export async function startAutoOpen(user: { id: string; name: string }, minutes: number, now = new Date()) {
  const settings = await getSettings();
  const m = resolveMinutes(minutes, settings.autoOpenMax);
  if (m === null) return { ok: false as const, error: `Choose ${AUTO_OPEN_CHOICES.filter((c) => c <= settings.autoOpenMax).join(", ")} minutes` };
  const until = new Date(now.getTime() + m * 60_000);
  const q = await db();
  await q(
    `INSERT INTO auto_open (id, until, enabled_by, enabled_by_name) VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET until = $1, enabled_by = $2, enabled_by_name = $3`,
    [until.toISOString(), user.id, user.name],
  );
  return { ok: true as const, until, minutes: m };
}

export async function cancelAutoOpen() {
  const q = await db();
  const rows = await q("UPDATE auto_open SET until = NULL WHERE id = 1 AND until IS NOT NULL RETURNING enabled_by_name");
  return rows.length > 0;
}
