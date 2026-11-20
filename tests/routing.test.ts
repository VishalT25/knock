import { describe, expect, it } from "vitest";
import { diffPlan, inQuietHours, isExpecting, planNotifications, shouldEscalate, type RoutingUser } from "@/lib/routing";

const now = new Date("2026-03-10T15:00:00Z"); // 15:00 UTC
const future = new Date(now.getTime() + 20 * 60_000);
const past = new Date(now.getTime() - 60_000);
const u = (id: string, extra: Partial<RoutingUser> = {}): RoutingUser => ({ id, expectingUntil: null, quietStart: null, quietEnd: null, ...extra });
const plan = (users: RoutingUser[], escalated = false, tz = "UTC", at = now) => planNotifications({ users, now: at, escalated, timeZone: tz });

describe("expecting", () => {
  it("is true only while expiry is in the future", () => {
    expect(isExpecting({ expectingUntil: future }, now)).toBe(true);
    expect(isExpecting({ expectingUntil: past }, now)).toBe(false);
    expect(isExpecting({ expectingUntil: null }, now)).toBe(false);
  });
});

describe("planNotifications", () => {
  it("pushes only expecting users loudly first; others get quiet pings", () => {
    const p = plan([u("a", { expectingUntil: future }), u("b"), u("c")]);
    expect(p).toEqual({ a: "loud", b: "quiet", c: "quiet" });
  });
  it("notifies everyone loudly when nobody is expecting", () => {
    expect(plan([u("a"), u("b"), u("c")])).toEqual({ a: "loud", b: "loud", c: "loud" });
  });
  it("ignores expired expecting", () => {
    expect(plan([u("a", { expectingUntil: past }), u("b")])).toEqual({ a: "loud", b: "loud" });
  });
  it("escalation makes everyone loud", () => {
    const p = plan([u("a", { expectingUntil: future }), u("b"), u("c")], true);
    expect(p).toEqual({ a: "loud", b: "loud", c: "loud" });
  });
  it("quiet hours downgrade a loud push unless the user is expecting", () => {
    const night = { quietStart: "14:00", quietEnd: "16:00" };
    expect(plan([u("a", night), u("b")])).toEqual({ a: "quiet", b: "loud" });
    expect(plan([u("a", { ...night, expectingUntil: future }), u("b")])).toEqual({ a: "loud", b: "quiet" });
    // still quiet after escalation when not expecting
    expect(plan([u("a", night), u("b")], true)).toEqual({ a: "quiet", b: "loud" });
  });
});

describe("inQuietHours", () => {
  it("handles windows that wrap midnight", () => {
    const w = { quietStart: "22:00", quietEnd: "07:00" };
    expect(inQuietHours(w, new Date("2026-03-10T23:30:00Z"), "UTC")).toBe(true);
    expect(inQuietHours(w, new Date("2026-03-10T06:59:00Z"), "UTC")).toBe(true);
    expect(inQuietHours(w, new Date("2026-03-10T07:00:00Z"), "UTC")).toBe(false);
    expect(inQuietHours(w, new Date("2026-03-10T12:00:00Z"), "UTC")).toBe(false);
  });
  it("uses the household time zone", () => {
    const w = { quietStart: "22:00", quietEnd: "07:00" };
    // 03:00 UTC = 23:00 in New York (EDT, UTC-4, in March after DST start)
    expect(inQuietHours(w, new Date("2026-03-10T03:00:00Z"), "America/New_York")).toBe(true);
    expect(inQuietHours(w, new Date("2026-03-10T15:00:00Z"), "America/New_York")).toBe(false);
  });
  it("is off when unset or equal", () => {
    expect(inQuietHours({ quietStart: null, quietEnd: null }, now, "UTC")).toBe(false);
    expect(inQuietHours({ quietStart: "10:00", quietEnd: "10:00" }, now, "UTC")).toBe(false);
  });
});

describe("diffPlan", () => {
  it("sends first notifications and quiet->loud upgrades, never downgrades or repeats", () => {
    expect(diffPlan({}, { a: "loud", b: "quiet" })).toEqual([{ userId: "a", mode: "loud" }, { userId: "b", mode: "quiet" }]);
    expect(diffPlan({ a: "loud", b: "quiet" }, { a: "loud", b: "loud" })).toEqual([{ userId: "b", mode: "loud" }]);
    expect(diffPlan({ a: "loud" }, { a: "quiet" })).toEqual([]);
    expect(diffPlan({ a: "loud", b: "quiet" }, { a: "loud", b: "quiet" })).toEqual([]);
  });
});

describe("shouldEscalate", () => {
  it("escalates after the delay, once", () => {
    const startedAt = new Date(now.getTime() - 9000);
    expect(shouldEscalate({ startedAt, now, escalateAfterSec: 8, alreadyEscalated: false })).toBe(true);
    expect(shouldEscalate({ startedAt, now, escalateAfterSec: 10, alreadyEscalated: false })).toBe(false);
    expect(shouldEscalate({ startedAt, now, escalateAfterSec: 8, alreadyEscalated: true })).toBe(false);
  });
});
