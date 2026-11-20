import { describe, expect, it } from "vitest";
import { formatPhone } from "@/lib/phone";

describe("formatPhone", () => {
  it("groups North American numbers and survives odd input", () => {
    expect(formatPhone("+14155550123")).toBe("+1 415 555 0123");
    expect(formatPhone("")).toBe("");
    expect(formatPhone("abc")).toBe("abc");
  });
});

import { cleanNumber } from "@/lib/config";
describe("cleanNumber", () => {
  it("repairs pasted env values", () => {
    expect(cleanNumber("+14155550123,")).toBe("+14155550123");
    expect(cleanNumber(" +1 (415) 555-0123 ")).toBe("+14155550123");
    expect(cleanNumber("14155550123")).toBe("+14155550123");
    expect(cleanNumber(undefined)).toBe("");
    expect(cleanNumber("")).toBe("");
  });
});
