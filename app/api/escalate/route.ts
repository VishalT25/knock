import { HttpError, rateLimit, requireMe, route } from "@/lib/auth";
import { escalate } from "@/lib/calls";

export const dynamic = "force-dynamic";
export const POST = route(async (req: Request) => {
  const me = await requireMe();
  await rateLimit(`esc:${me.id}`, 20, 60);
  const body = await req.json().catch(() => ({}));
  if (typeof body.callId !== "string") throw new HttpError(400, "callId required");
  return Response.json({ ok: true, escalated: await escalate(body.callId) });
});
