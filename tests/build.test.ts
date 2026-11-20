import { describe, expect, it } from "vitest";
import { isStaleBuild } from "@/lib/build";

describe("isStaleBuild", () => {
  it("is true only when both sides are real builds and they differ", () => {
    expect(isStaleBuild("abc123", "def456")).toBe(true);
    expect(isStaleBuild("abc123", "abc123")).toBe(false);
  });
  it("never nags in local development or when a side is unknown", () => {
    expect(isStaleBuild("dev", "def456")).toBe(false);
    expect(isStaleBuild("abc123", "dev")).toBe(false);
    expect(isStaleBuild(undefined, "def456")).toBe(false);
    expect(isStaleBuild("abc123", undefined)).toBe(false);
  });
});
