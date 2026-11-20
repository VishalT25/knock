import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const COOKIE = "knock_session";
export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export type Me = { id: string; name: string; role: "admin" | "member"; deviceId: string };

export async function createDevice(userId: string, label: string | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const q = await db();
  const rows = await q("INSERT INTO devices (user_id, token_hash, label) VALUES ($1, $2, $3) RETURNING id", [userId, sha(token), label]);
  return { token, deviceId: rows[0].id as string };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getMe(): Promise<Me | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const q = await db();
  const rows = await q(
    `SELECT u.id, u.name, u.role, d.id AS device_id FROM devices d JOIN users u ON u.id = d.user_id
     WHERE d.token_hash = $1 AND d.revoked_at IS NULL`,
    [sha(token)],
  );
  const r = rows[0];
  if (!r) return null;
  // best-effort touch
  q("UPDATE devices SET last_seen = now() WHERE id = $1", [r.device_id]).catch(() => {});
  return { id: r.id, name: r.name, role: r.role, deviceId: r.device_id };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new HttpError(401, "Not signed in");
  return me;
}
export async function requireAdmin(): Promise<Me> {
  const me = await requireMe();
  if (me.role !== "admin") throw new HttpError(403, "Admins only");
  return me;
}

/** Wrap a route handler: maps HttpError to JSON. */
export function route<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

/* ---- Rate limit: fixed window in Postgres ---- */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const q = await db();
  const rows = await q(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSec],
  );
  if (rows[0].count > limit) throw new HttpError(429, "Too many attempts. Wait a moment and try again.");
}
