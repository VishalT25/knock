import { createDevice, HttpError, rateLimit, route, setSessionCookie, sha } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanName, clientIp, normalizeCode, readJson } from "@/lib/util";
import { getHousehold } from "@/lib/config";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  await rateLimit(`join:${ip}`, 8, 600);
  await rateLimit("join:global", 40, 3600);
  if (!(await getHousehold())) throw new HttpError(409, "Setup has not been completed yet.");
  const body = await readJson(req);
  const name = cleanName(body.name);
  const code = normalizeCode(String(body.code ?? ""));
  if (code.length < 10) throw new HttpError(400, "That invite code looks too short.");
  const q = await db();
  // Single-use, atomic.
  const used = await q(
    "UPDATE invites SET used_at = now() WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING code_hash",
    [sha(code)],
  );
  if (!used[0]) throw new HttpError(400, "That invite code is invalid, used or expired. Ask the admin for a new one.");
  const u = await q("INSERT INTO users (name, role) VALUES ($1, 'member') RETURNING id", [name]);
  await q("UPDATE invites SET used_by = $2 WHERE code_hash = $1", [sha(code), u[0].id]);
  const { token } = await createDevice(u[0].id, String(body.label ?? "").slice(0, 60) || null);
  await setSessionCookie(token);
  return Response.json({ ok: true });
});
