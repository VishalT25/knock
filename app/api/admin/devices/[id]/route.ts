import { HttpError, requireAdmin, route } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireAdmin();
  const { id } = await ctx.params;
  if (id === me.deviceId) throw new HttpError(400, "Use Sign out to remove this device.");
  const q = await db();
  await q("UPDATE devices SET revoked_at = now(), push_sub = NULL WHERE id = $1", [id]);
  return Response.json({ ok: true });
});
