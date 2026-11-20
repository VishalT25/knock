import { describe, expect, it } from "vitest";
import { formatPhone } from "@/lib/phone";

describe("formatPhone", () => {
  it("groups North American numbers and survives odd input", () => {
    expect(formatPhone("+14155550123")).toBe("+1 415 555 0123");
    expect(formatPhone("")).toBe("");
    expect(formatPhone("abc")).toBe("abc");
  });
});
