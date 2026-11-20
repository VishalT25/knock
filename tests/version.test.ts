import { describe, expect, it } from "vitest";
import { isNewer, VERSION } from "@/lib/version";

describe("isNewer", () => {
  it("compares x.y.z numerically, not as text", () => {
    expect(isNewer("0.10.0", "0.9.0")).toBe(true);
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
    expect(isNewer("0.2.1", "0.2.0")).toBe(true);
  });
  it("is false for the same or an older version", () => {
    expect(isNewer("0.2.0", "0.2.0")).toBe(false);
    expect(isNewer("0.1.9", "0.2.0")).toBe(false);
  });
  it("ignores a leading v and refuses to guess on junk", () => {
    expect(isNewer("v0.3.0", "0.2.0")).toBe(true);
    expect(isNewer("", "0.2.0")).toBe(false);
    expect(isNewer("latest", "0.2.0")).toBe(false);
  });
  it("reads the real package version", () => { expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/); });
});
