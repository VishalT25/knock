import { rateLimit, requireMe, route } from "@/lib/auth";
import { claimAdmin } from "@/lib/members";
import { clientIp, readJson } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Make this phone an admin by entering the setup password. { token } */
export const POST = route(async (req: Request) => {
  const me = await requireMe();
  await rateLimit(`claim:${clientIp(req)}`, 5, 3600);
  await rateLimit(`claim:${me.id}`, 5, 3600);
  const body = await readJson(req);
  await claimAdmin(me, body.token, process.env.SETUP_TOKEN);
  return Response.json({ ok: true });
});
