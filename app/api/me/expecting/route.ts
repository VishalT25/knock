import { HttpError, requireMe, route } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson } from "@/lib/util";

export const dynamic = "force-dynamic";
export const DEFAULT_EXPECT_MIN = 45;

export const POST = route(async (req: Request) => {
  const me = await requireMe();
  const b = await readJson(req);
  const q = await db();
  if (b.on === false) {
    await q("UPDATE users SET expecting_until = NULL WHERE id = $1", [me.id]);
    return Response.json({ ok: true, expectingUntil: null });
  }
  const minutes = b.minutes === undefined ? DEFAULT_EXPECT_MIN : Number(b.minutes);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) throw new HttpError(400, "Pick 5 to 240 minutes.");
  const rows = await q("UPDATE users SET expecting_until = now() + make_interval(mins => $2) WHERE id = $1 RETURNING expecting_until", [me.id, minutes]);
  return Response.json({ ok: true, expectingUntil: new Date(rows[0].expecting_until).toISOString() });
});
