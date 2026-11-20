import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { cleanKey, normalizeSubject, vapidProblem } from "@/lib/vapid";

// Throwaway keys generated per run: no real key ever lives in the repo.
const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
const PUB = ecdh.getPublicKey().toString("base64url");
const PRIV = ecdh.getPrivateKey().toString("base64url");

describe("vapidProblem", () => {
  it("accepts a real key pair and tolerates quotes and whitespace", () => {
    expect(vapidProblem(PUB, PRIV)).toBeNull();
    expect(vapidProblem(`"${PUB}"\n`, ` ${PRIV} `)).toBeNull();
    expect(cleanKey(`  "${PUB}"  `)).toBe(PUB);
  });
  it("explains the common paste mistakes", () => {
    expect(vapidProblem(undefined, PRIV)).toMatch(/both needed/);
    expect(vapidProblem(PRIV, PRIV)).toMatch(/private key/);
    expect(vapidProblem(PUB.slice(0, 60), PRIV)).toMatch(/wrong length/);
    expect(vapidProblem(PUB, PRIV.slice(0, 20))).toMatch(/PRIVATE/);
    expect(vapidProblem("not a key!!", PRIV)).toMatch(/characters/);
  });
});

describe("pair and subject checks", () => {
  it("detects two valid keys that are not a pair", () => {
    const other = crypto.createECDH("prime256v1"); other.generateKeys();
    expect(vapidProblem(PUB, other.getPrivateKey().toString("base64url"))).toMatch(/not a pair/);
    expect(vapidProblem(PUB, PRIV)).toBeNull();
  });
  it("repairs VAPID_SUBJECT values the push library would reject", () => {
    expect(normalizeSubject("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeSubject("a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeSubject(' "a@b.co" ')).toBe("mailto:a@b.co");
    expect(normalizeSubject("https://example.com/x")).toBe("https://example.com/x");
    expect(normalizeSubject("example.com")).toBe("https://example.com");
    expect(normalizeSubject("")).toBe("mailto:admin@example.com");
    expect(normalizeSubject(undefined)).toBe("mailto:admin@example.com");
    expect(normalizeSubject("not valid at all")).toBe("mailto:admin@example.com");
  });
});
