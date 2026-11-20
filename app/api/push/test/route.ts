import { rateLimit, requireMe, route, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendToSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Send a test notification to THIS device and report the push service's answer. */
export const POST = route(async () => {
  const me = await requireMe();
  await rateLimit(`pushtest:${me.id}`, 6, 60);
  const q = await db();
  const rows = await q("SELECT push_sub FROM devices WHERE id = $1", [me.deviceId]);
  const sub = rows[0]?.push_sub;
  if (!sub) throw new HttpError(409, "This phone isn't subscribed yet. Turn on notifications first.");
  const res = await sendToSubscription(typeof sub === "string" ? JSON.parse(sub) : sub, {
    kind: "test", title: "Notifications are on", body: "You'll hear the door on this phone.", url: "/", tag: "knock-test",
  });
  if (!res.ok) throw new HttpError(502, res.message);
  return Response.json({ ok: true });
});
