import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyTelnyxSignature } from "@/lib/telnyx";

function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return { privateKey, pub: publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64") };
}
const sign = (priv: crypto.KeyObject, ts: string, body: string) => crypto.sign(null, Buffer.from(`${ts}|${body}`), priv).toString("base64");

describe("verifyTelnyxSignature", () => {
  const body = JSON.stringify({ data: { event_type: "call.initiated" } });
  const ts = String(Math.floor(Date.now() / 1000));

  it("accepts a valid signature", () => {
    const k = keypair();
    expect(verifyTelnyxSignature({ rawBody: body, signature: sign(k.privateKey, ts, body), timestamp: ts, publicKey: k.pub })).toBe(true);
  });
  it("rejects unsigned, tampered, wrong-key and stale requests", () => {
    const k = keypair();
    const other = keypair();
    const sig = sign(k.privateKey, ts, body);
    expect(verifyTelnyxSignature({ rawBody: body, signature: null, timestamp: ts, publicKey: k.pub })).toBe(false);
    expect(verifyTelnyxSignature({ rawBody: body + " ", signature: sig, timestamp: ts, publicKey: k.pub })).toBe(false);
    expect(verifyTelnyxSignature({ rawBody: body, signature: sig, timestamp: ts, publicKey: other.pub })).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyTelnyxSignature({ rawBody: body, signature: sign(k.privateKey, old, body), timestamp: old, publicKey: k.pub })).toBe(false);
    expect(verifyTelnyxSignature({ rawBody: body, signature: sig, timestamp: ts, publicKey: null })).toBe(false);
  });
});
