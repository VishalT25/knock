import crypto from "node:crypto";
import { HttpError } from "./auth";

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export function cleanName(v: unknown) {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (s.length < 1 || s.length > 32) throw new HttpError(400, "Name must be 1 to 32 characters.");
  return s;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeInviteCode() {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `KNOCK-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
export function isTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s);
