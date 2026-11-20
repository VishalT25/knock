import { afterEach, describe, expect, it } from "vitest";
import { sendToSubscription, setPushSenderForTests } from "@/lib/push";
import { resetVapidCacheForTests } from "@/lib/vapid-store";
import { freshWorld } from "./helpers";

afterEach(() => setPushSenderForTests(null));
const payload = { kind: "test" as const, title: "t", body: "b" };

describe("sendToSubscription", () => {
  it("reports success", async () => {
    setPushSenderForTests(async () => {});
    expect(await sendToSubscription({}, payload)).toEqual({ ok: true });
  });
  it("turns push-service errors into plain advice with the status code", async () => {
    const fail = (statusCode: number) => setPushSenderForTests(async () => { throw Object.assign(new Error("x"), { statusCode, body: "BadJwtToken" }); });
    fail(403);
    const r403 = await sendToSubscription({}, payload);
    expect(r403.ok).toBe(false);
    expect((r403 as any).message).toMatch(/matching pair.*HTTP 403/s);
    fail(410);
    expect(((await sendToSubscription({}, payload)) as any).message).toMatch(/expired.*HTTP 410/s);
    fail(400);
    expect(((await sendToSubscription({}, payload)) as any).message).toMatch(/turn notifications off and on/i);
  });
});

import crypto from "node:crypto";
describe("web-push library loads (regression: default import was undefined in production)", () => {
  it("gets past setup and fails only on the network, not with a library error", async () => {
    await freshWorld();
    setPushSenderForTests(null); // freshWorld installs a fake sender; this test must use the real library
    resetVapidCacheForTests();
    const e = crypto.createECDH("prime256v1"); e.generateKeys();
    process.env.VAPID_PUBLIC_KEY = e.getPublicKey().toString("base64url");
    process.env.VAPID_PRIVATE_KEY = e.getPrivateKey().toString("base64url");
    process.env.VAPID_SUBJECT = "someone@example.com"; // bare email: must be repaired, not rejected
    const r = await sendToSubscription({ endpoint: "https://127.0.0.1:9/none", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } }, payload);
    expect(r.ok).toBe(false);
    expect((r as any).message).not.toMatch(/couldn't set up push/);
    expect((r as any).message).not.toMatch(/undefined/);
  });
});
