import { after } from "next/server";
import { HttpError, rateLimit, requireMe, route } from "@/lib/auth";
import { openDoor } from "@/lib/calls";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = route(async (req: Request) => {
  const me = await requireMe();
  await rateLimit(`open:${me.id}`, 12, 60);
  const body = await req.json().catch(() => ({}));
  if (typeof body.callId !== "string") throw new HttpError(400, "callId required");
  const res = await openDoor(body.callId, { id: me.id, name: me.name }, "button", { defer: (fn) => after(fn) });
  if (res.ok) return Response.json({ ok: true, openedBy: me.name });
  if (res.reason === "already") {
    return Response.json({ ok: false, error: `Already opened by ${res.call?.openedByName ?? "someone"}`, openedBy: res.call?.openedByName ?? null }, { status: 409 });
  }
  if (res.reason === "ended") return Response.json({ ok: false, error: "The visitor already hung up." }, { status: 410 });
  return Response.json({ ok: false, error: `Could not send the tone: ${res.error}` }, { status: 502 });
});
