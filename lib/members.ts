import crypto from "node:crypto";
import { HttpError } from "./auth";
import { db } from "./db";

export type Role = "admin" | "member";

/**
 * Change someone's role. Only an admin gets here (the route checks). You can't change your own role, so a household
 * can never be left without an admin: whoever is making the change stays one.
 */
export async function setRole(actor: { id: string }, targetId: string, role: unknown): Promise<{ id: string; name: string; role: Role }> {
  if (role !== "admin" && role !== "member") throw new HttpError(400, "Role must be admin or member.");
  if (targetId === actor.id) throw new HttpError(400, "You can't change your own role. Ask another admin.");
  const q = await db();
  const rows = await q("UPDATE users SET role = $2 WHERE id = $1 RETURNING id, name, role", [targetId, role]);
  if (!rows[0]) throw new HttpError(404, "That person isn't in this household.");
  return { id: rows[0].id, name: rows[0].name, role: rows[0].role };
}

const digest = (s: string) => crypto.createHash("sha256").update(s).digest();

/**
 * Lets a signed-in person make themselves an admin by proving they own the deployment: they know its setup password
 * (the SETUP_TOKEN environment variable only the owner can read). For a household whose admin session is stuck on
 * another browser, or lost. Callers must rate-limit.
 */
export async function claimAdmin(actor: { id: string }, given: unknown, expected: string | undefined): Promise<void> {
  if (!expected) throw new HttpError(400, "This server has no setup password (SETUP_TOKEN), so admin can't be claimed here.");
  if (typeof given !== "string" || !crypto.timingSafeEqual(digest(given), digest(expected))) throw new HttpError(403, "That isn't the setup password.");
  const q = await db();
  await q("UPDATE users SET role = 'admin' WHERE id = $1", [actor.id]);
}
