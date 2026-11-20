import { HttpError, requireAdmin, route } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/config";
import { cleanName, isE164, isTimeZone, readJson } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return Response.json(await getSettings());
});

export const PATCH = route(async (req: Request) => {
  await requireAdmin();
  const b = await readJson(req);
  const q = await db();
  const set = async (col: string, v: unknown) => q(`UPDATE household SET ${col} = $1 WHERE id = 1`, [v]);
  const int = (v: unknown, lo: number, hi: number, label: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, `${label} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  if (b.householdName !== undefined) await set("name", cleanName(b.householdName));
  if (b.timezone !== undefined) {
    if (!isTimeZone(b.timezone)) throw new HttpError(400, "Unknown time zone.");
    await set("timezone", b.timezone);
  }
  if (b.unlockDigit !== undefined) {
    if (!/^[0-9*#]{1,8}$/.test(String(b.unlockDigit))) throw new HttpError(400, "Unlock digit must be 0-9, * or # (up to 8 characters).");
    await set("unlock_digit", String(b.unlockDigit));
  }
  if (b.escalateAfter !== undefined) await set("escalate_after", int(b.escalateAfter, 0, 120, "Escalate after"));
  if (b.backupTimeout !== undefined) await set("backup_timeout", int(b.backupTimeout, 5, 120, "Backup timeout"));
  if (b.autoOpenMax !== undefined) await set("auto_open_max", int(b.autoOpenMax, 10, 60, "Auto-open maximum"));
  if (b.fallbackNumber !== undefined) {
    const n = String(b.fallbackNumber).replace(/[\s()-]/g, "");
    if (n && !isE164(n)) throw new HttpError(400, "Fallback number must look like +14155550123, or be empty.");
    await set("fallback_number", n);
  }
  return Response.json(await getSettings());
});
