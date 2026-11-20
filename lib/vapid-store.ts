import crypto from "node:crypto";
import { db } from "./db";
import { cleanKey, normalizeSubject, vapidProblem } from "./vapid";

export type Vapid =
  | { ok: true; publicKey: string; privateKey: string; subject: string; source: "env" | "generated" }
  | { ok: false; problem: string };

let cache: Vapid | null = null;
export function resetVapidCacheForTests() {
  cache = null;
}

function generate() {
  const e = crypto.createECDH("prime256v1");
  e.generateKeys();
  return { publicKey: e.getPublicKey().toString("base64url"), privateKey: e.getPrivateKey().toString("base64url") };
}

/**
 * Where the web-push keys come from:
 *  1. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in the environment, if you set them (validated, never silently replaced).
 *  2. Otherwise a key pair the app generates on first use and keeps in the database, so one-click installs
 *     need no manual key step.
 */
export async function getVapid(): Promise<Vapid> {
  if (cache?.ok) return cache;
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  const subject = normalizeSubject(process.env.VAPID_SUBJECT);

  if (cleanKey(envPub) || cleanKey(envPriv)) {
    const problem = vapidProblem(envPub, envPriv);
    if (problem) return { ok: false, problem };
    return (cache = { ok: true, publicKey: cleanKey(envPub), privateKey: cleanKey(envPriv), subject, source: "env" });
  }

  const q = await db();
  const read = () => q("SELECT key, value FROM secrets WHERE key IN ('vapid_public', 'vapid_private')");
  let rows = await read();
  if (rows.length < 2) {
    const g = generate();
    // One statement, so a concurrent first request either wins both rows or skips both.
    await q("INSERT INTO secrets (key, value) VALUES ('vapid_public', $1), ('vapid_private', $2) ON CONFLICT (key) DO NOTHING", [g.publicKey, g.privateKey]);
    rows = await read();
  }
  const publicKey = rows.find((r) => r.key === "vapid_public")?.value as string | undefined;
  const privateKey = rows.find((r) => r.key === "vapid_private")?.value as string | undefined;
  const problem = vapidProblem(publicKey, privateKey);
  if (problem) return { ok: false, problem: `The stored push keys are damaged (${problem})` };
  return (cache = { ok: true, publicKey: publicKey!, privateKey: privateKey!, subject, source: "generated" });
}
