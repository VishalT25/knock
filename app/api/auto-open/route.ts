import { HttpError, requireMe, route } from "@/lib/auth";
import { cancelAutoOpen, startAutoOpen } from "@/lib/autoopen";
import { pushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const me = await requireMe();
  const body = await req.json().catch(() => ({}));
  const res = await startAutoOpen({ id: me.id, name: me.name }, Number(body.minutes));
  if (!res.ok) throw new HttpError(400, res.error);
  await pushToUsers(
    "all",
    { kind: "info", title: "Auto-open is ON", body: `${me.name} turned on auto-open for ${res.minutes} min. Calls will open by themselves.`, url: "/", tag: "knock-auto" },
    "info",
  );
  return Response.json({ ok: true, until: res.until.toISOString() });
});

export const DELETE = route(async () => {
  const me = await requireMe();
  if (await cancelAutoOpen()) {
    await pushToUsers("all", { kind: "info", title: "Auto-open is OFF", body: `${me.name} cancelled auto-open.`, url: "/", tag: "knock-auto" }, "info");
  }
  return Response.json({ ok: true });
});
