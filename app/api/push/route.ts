import { requireMe, route, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson } from "@/lib/util";
import { cleanKey, vapidProblem } from "@/lib/vapid";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireMe();
  const problem = vapidProblem(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return Response.json({ publicKey: problem ? null : cleanKey(process.env.VAPID_PUBLIC_KEY), problem });
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
