import { requireMe, route, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireMe();
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

export const POST = route(async (req: Request) => {
  const me = await requireMe();
  const body = await readJson(req);
  const sub = body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new HttpError(400, "Invalid push subscription");
  const q = await db();
  await q("UPDATE devices SET push_sub = $2::jsonb WHERE id = $1", [me.deviceId, JSON.stringify(sub)]);
  return Response.json({ ok: true });
});

export const DELETE = route(async () => {
  const me = await requireMe();
  const q = await db();
  await q("UPDATE devices SET push_sub = NULL WHERE id = $1", [me.deviceId]);
  return Response.json({ ok: true });
});
