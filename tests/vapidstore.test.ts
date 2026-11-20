import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getVapid, resetVapidCacheForTests } from "@/lib/vapid-store";
import { vapidProblem } from "@/lib/vapid";
import { freshWorld } from "./helpers";

const KEYS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(async () => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  await freshWorld();
  resetVapidCacheForTests();
});
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } resetVapidCacheForTests(); });

describe("push keys with no environment setup (one-click installs)", () => {
  it("generates a valid pair on first use and keeps returning the same one", async () => {
    const a = await getVapid();
    expect(a.ok && a.source).toBe("generated");
    if (!a.ok) return;
    expect(vapidProblem(a.publicKey, a.privateKey)).toBeNull();
    resetVapidCacheForTests(); // simulate a cold start: must come from the database, not be regenerated
    const b = await getVapid();
    expect(b.ok && b.publicKey).toBe(a.publicKey);
  });
  it("two simultaneous first requests end up with one consistent pair", async () => {
    const [x, y] = await Promise.all([getVapid(), getVapid()]);
    resetVapidCacheForTests();
    const z = await getVapid();
    expect(x.ok && y.ok && z.ok).toBe(true);
    if (x.ok && z.ok) expect(vapidProblem(z.publicKey, z.privateKey)).toBeNull();
  });
});

describe("push keys from the environment", () => {
  it("uses valid env keys, and never silently replaces broken ones", async () => {
    const e = crypto.createECDH("prime256v1"); e.generateKeys();
    process.env.VAPID_PUBLIC_KEY = e.getPublicKey().toString("base64url");
    process.env.VAPID_PRIVATE_KEY = e.getPrivateKey().toString("base64url");
    const ok = await getVapid();
    expect(ok.ok && ok.source).toBe("env");
    resetVapidCacheForTests();
    process.env.VAPID_PUBLIC_KEY = "truncated";
    const bad = await getVapid();
    expect(bad.ok).toBe(false);
  });
});
