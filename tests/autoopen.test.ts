import { beforeEach, describe, expect, it } from "vitest";
import { activeWindow, cancelAutoOpen, getAutoOpen, resolveMinutes, startAutoOpen } from "@/lib/autoopen";
import { freshWorld } from "./helpers";

describe("resolveMinutes", () => {
  it("accepts only the allowed choices up to the max", () => {
    expect(resolveMinutes(10, 60)).toBe(10);
    expect(resolveMinutes(60, 60)).toBe(60);
    expect(resolveMinutes(15, 60)).toBeNull();
    expect(resolveMinutes(60, 30)).toBeNull();
    expect(resolveMinutes(90, 120)).toBeNull(); // hard cap of 60
  });
});

describe("activeWindow", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  it("is active strictly before expiry", () => {
    expect(activeWindow({ until: new Date(now.getTime() + 1000), byName: "A" }, now)).not.toBeNull();
    expect(activeWindow({ until: now, byName: "A" }, now)).toBeNull();
    expect(activeWindow({ until: null }, now)).toBeNull();
    expect(activeWindow(undefined, now)).toBeNull();
  });
});

describe("auto-open persistence", () => {
  let W: Awaited<ReturnType<typeof freshWorld>>;
  beforeEach(async () => { W = await freshWorld(); });

  it("starts, reports who enabled it, and expires on its own", async () => {
    const t0 = new Date("2026-03-10T12:00:00Z");
    const r = await startAutoOpen({ id: W.ids.Ana, name: "Ana" }, 20, t0);
    expect(r.ok && r.minutes).toBe(20);
    expect(await getAutoOpen(new Date(t0.getTime() + 19 * 60_000))).toMatchObject({ byName: "Ana" });
    expect(await getAutoOpen(new Date(t0.getTime() + 20 * 60_000 + 1))).toBeNull();
  });

  it("rejects durations that are not offered or exceed the configured max", async () => {
    expect((await startAutoOpen({ id: W.ids.Ana, name: "Ana" }, 45)).ok).toBe(false);
    await W.q("UPDATE household SET auto_open_max = 30 WHERE id = 1");
    expect((await startAutoOpen({ id: W.ids.Ana, name: "Ana" }, 60)).ok).toBe(false);
    expect((await startAutoOpen({ id: W.ids.Ana, name: "Ana" }, 30)).ok).toBe(true);
  });

  it("cancel turns it off immediately", async () => {
    await startAutoOpen({ id: W.ids.Ana, name: "Ana" }, 10);
    expect(await cancelAutoOpen()).toBe(true);
    expect(await getAutoOpen()).toBeNull();
    expect(await cancelAutoOpen()).toBe(false);
  });
});

import { getSettings } from "@/lib/config";
describe("greeting setting", () => {
  it("is off by default and can be turned on", async () => {
    const W = await freshWorld();
    expect((await getSettings()).greeting).toBe(false);
    await W.q("UPDATE household SET greeting = true WHERE id = 1");
    expect((await getSettings()).greeting).toBe(true);
  });
});
