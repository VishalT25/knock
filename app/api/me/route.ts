import { clearSessionCookie, HttpError, requireMe, route } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanName, isTime, readJson } from "@/lib/util";

export const dynamic = "force-dynamic";

export const PATCH = route(async (req: Request) => {
  const me = await requireMe();
  const b = await readJson(req);
  const q = await db();
  if (b.name !== undefined) await q("UPDATE users SET name = $2 WHERE id = $1", [me.id, cleanName(b.name)]);
  if ("quietStart" in b || "quietEnd" in b) {
    const s = b.quietStart || null;
    const e = b.quietEnd || null;
    if ((s && !isTime(s)) || (e && !isTime(e)) || (!!s !== !!e)) throw new HttpError(400, "Set both quiet-hours times (HH:MM), or clear both.");
    await q("UPDATE users SET quiet_start = $2, quiet_end = $3 WHERE id = $1", [me.id, s, e]);
  }
  return Response.json({ ok: true });
});

/** Sign out this device. */
export const DELETE = route(async () => {
  const me = await requireMe();
  const q = await db();
  await q("UPDATE devices SET revoked_at = now(), push_sub = NULL WHERE id = $1", [me.deviceId]);
  await clearSessionCookie();
  return Response.json({ ok: true });
});
