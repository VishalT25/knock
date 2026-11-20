import { createDevice, HttpError, rateLimit, route, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHousehold } from "@/lib/config";
import { cleanName, clientIp, isTimeZone, readJson } from "@/lib/util";
import { isMock } from "@/lib/telnyx";

export const dynamic = "force-dynamic";

const prod = () => process.env.NODE_ENV === "production";

export const GET = route(async () => {
  const h = await getHousehold();
  return Response.json({
    needsSetup: !h,
    tokenRequired: !!process.env.SETUP_TOKEN || prod(),
    tokenMissingOnServer: prod() && !process.env.SETUP_TOKEN,
    mock: isMock(),
  });
});

export const POST = route(async (req: Request) => {
  await rateLimit(`setup:${clientIp(req)}`, 10, 600);
  if (await getHousehold()) throw new HttpError(409, "This household is already set up.");
  const body = await readJson(req);
  const need = process.env.SETUP_TOKEN;
  if (prod() && !need) throw new HttpError(500, "Set SETUP_TOKEN in the server environment before running first-time setup.");
  if (need && body.token !== need) throw new HttpError(403, "Setup token is wrong.");
  const householdName = cleanName(body.householdName);
  const adminName = cleanName(body.adminName);
  const tz = isTimeZone(body.timezone) ? body.timezone : "UTC";
  const q = await db();
  const created = await q("INSERT INTO household (id, name, timezone) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING RETURNING id", [householdName, tz]);
  if (!created[0]) throw new HttpError(409, "This household is already set up.");
  const u = await q("INSERT INTO users (name, role) VALUES ($1, 'admin') RETURNING id", [adminName]);
  const { token } = await createDevice(u[0].id, String(body.label ?? "Admin device").slice(0, 60));
  await setSessionCookie(token);
  return Response.json({ ok: true });
});
