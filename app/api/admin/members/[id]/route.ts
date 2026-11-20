import { HttpError, requireAdmin, route } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireAdmin();
  const { id } = await ctx.params;
  if (id === me.id) throw new HttpError(400, "You can't remove yourself.");
  const q = await db();
  await q("DELETE FROM users WHERE id = $1", [id]); // devices cascade
  return Response.json({ ok: true });
});
