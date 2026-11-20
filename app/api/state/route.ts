import { requireMe, route } from "@/lib/auth";
import { buildState } from "@/lib/state";

export const dynamic = "force-dynamic";
export const GET = route(async () => {
  const me = await requireMe();
  return Response.json(await buildState(me), { headers: { "Cache-Control": "no-store" } });
});
