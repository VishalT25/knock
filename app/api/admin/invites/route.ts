import { HttpError, requireAdmin, route, sha } from "@/lib/auth";
import { db } from "@/lib/db";
import { makeInviteCode, normalizeCode, readJson } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const me = await requireAdmin();
  const b = await readJson(req);
  const hours = [1, 24, 168].includes(Number(b.hours)) ? Number(b.hours) : 24;
  const code = makeInviteCode();
  const q = await db();
  await q("INSERT INTO invites (code_hash, hint, created_by, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))", [
    sha(normalizeCode(code)),
    `KNOCK-····-${code.slice(-2)}`,
    me.id,
    hours,
  ]);
  return Response.json({ code, hours });
});

/** Rotate: revoke every outstanding invite. */
export const DELETE = route(async (req: Request) => {
  await requireAdmin();
  const id = new URL(req.url).searchParams.get("id");
  const q = await db();
  if (id) await q("DELETE FROM invites WHERE code_hash = $1 AND used_at IS NULL", [id]);
  else await q("DELETE FROM invites WHERE used_at IS NULL");
  return Response.json({ ok: true });
});
