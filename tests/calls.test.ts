import { beforeEach, describe, expect, it } from "vitest";
import { claimCall, escalate, getCall, handleHangup, notifyCall, openDoor, registerCall, runLifecycle, startFallback, tick } from "@/lib/calls";
import { fakeTelephony, freshWorld, pushesTo } from "./helpers";

let W: Awaited<ReturnType<typeof freshWorld>>;
beforeEach(async () => { W = await freshWorld(); });

const newCall = async (id = "cc-1") => (await registerCall(id)).call;

describe("claim-once", () => {
  it("lets exactly one of many concurrent taps win and sends one tone", async () => {
    const call = await newCall();
    const actors = ["Ana", "Ben", "Cy", "Ana", "Ben", "Cy"].map((n) => ({ id: W.ids[n], name: n }));
    const results = await Promise.all(actors.map((a) => openDoor(call.id, a, "button")));
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(W.calls.filter((c) => c.action === "dtmf")).toEqual([{ action: "dtmf", id: "cc-1", arg: "9" }]);
    expect(W.calls.filter((c) => c.action === "hangup")).toHaveLength(1);
    const losers = results.filter((r) => !r.ok);
    expect(losers.every((r) => !r.ok && r.reason === "already")).toBe(true);
    const final = await getCall(call.id);
    expect(final?.status).toBe("opened");
    expect(final?.method).toBe("button");
    expect(final?.openedByName).toBe((winners[0] as any).call.openedByName);
  });

  it("claimCall is a single atomic transition", async () => {
    const call = await newCall();
    const [a, b] = await Promise.all([claimCall(call.id, { id: W.ids.Ana, name: "Ana" }, "button"), claimCall(call.id, { id: W.ids.Ben, name: "Ben" }, "button")]);
    expect([a.won, b.won].filter(Boolean)).toHaveLength(1);
  });

  it("refuses a second open after the door opened, and after the visitor left", async () => {
    const call = await newCall();
    await openDoor(call.id, { id: W.ids.Ana, name: "Ana" }, "button");
    const again = await openDoor(call.id, { id: W.ids.Ben, name: "Ben" }, "button");
    expect(again).toMatchObject({ ok: false, reason: "already" });

    const c2 = await newCall("cc-2");
    await handleHangup("cc-2");
    const late = await openDoor(c2.id, { id: W.ids.Ben, name: "Ben" }, "button");
    expect(late).toMatchObject({ ok: false, reason: "ended" });
    expect(W.calls.filter((c) => c.action === "dtmf" && c.id === "cc-2")).toHaveLength(0);
  });

  it("releases the claim if the tone cannot be sent, so someone else can retry", async () => {
    const call = await newCall();
    fakeTelephony({ failDtmf: true });
    const r = await openDoor(call.id, { id: W.ids.Ana, name: "Ana" }, "button");
    expect(r).toMatchObject({ ok: false, reason: "error" });
    expect((await getCall(call.id))?.status).toBe("ringing");
    const calls = fakeTelephony();
    const retry = await openDoor(call.id, { id: W.ids.Ben, name: "Ben" }, "button");
    expect(retry.ok).toBe(true);
    expect(calls.filter((c) => c.action === "dtmf")).toHaveLength(1);
  });

  it("clears the opener's expecting flag, and only theirs", async () => {
    const future = new Date(Date.now() + 600_000).toISOString();
    await W.q("UPDATE users SET expecting_until = $1 WHERE id = ANY($2::uuid[])", [future, [W.ids.Ana, W.ids.Ben]]);
    const call = await newCall();
    await openDoor(call.id, { id: W.ids.Ana, name: "Ana" }, "button");
    const rows = await W.q("SELECT name, expecting_until FROM users ORDER BY name");
    expect(rows.find((r) => r.name === "Ana")!.expecting_until).toBeNull();
    expect(rows.find((r) => r.name === "Ben")!.expecting_until).not.toBeNull();
  });

  it("tells everyone the door opened (to replace their notification)", async () => {
    const call = await newCall();
    await openDoor(call.id, { id: W.ids.Ben, name: "Ben" }, "button");
    for (const n of ["Ana", "Ben", "Cy"]) {
      const p = pushesTo(W.ids[n], "opened");
      expect(p).toHaveLength(1);
      expect(p[0].payload.title).toBe("Opened by Ben");
      expect(p[0].payload.tag).toBe("knock-call");
    }
  });
});

describe("notification flow", () => {
  it("expecting users first, quiet pings to the rest, then escalation upgrades the rest once", async () => {
    await W.q("UPDATE users SET expecting_until = now() + interval '10 minutes' WHERE id = $1", [W.ids.Ana]);
    const call = await newCall();
    await notifyCall(call.id);
    expect(pushesTo(W.ids.Ana, "ring")).toHaveLength(1);
    expect(pushesTo(W.ids.Ben, "quiet")).toHaveLength(1);
    expect(pushesTo(W.ids.Cy, "quiet")).toHaveLength(1);
    expect(pushesTo(W.ids.Ben, "ring")).toHaveLength(0);

    await notifyCall(call.id); // idempotent
    expect(pushesTo(W.ids.Ana, "ring")).toHaveLength(1);

    expect(await escalate(call.id)).toBe(true);
    expect(await escalate(call.id)).toBe(false); // "Not mine" twice is a no-op
    expect(pushesTo(W.ids.Ben, "ring")).toHaveLength(1);
    expect(pushesTo(W.ids.Cy, "ring")).toHaveLength(1);
    expect(pushesTo(W.ids.Ana, "ring")).toHaveLength(1); // not re-sent
  });

  it("notifies everyone loudly when nobody is expecting", async () => {
    const call = await newCall();
    await notifyCall(call.id);
    for (const n of ["Ana", "Ben", "Cy"]) expect(pushesTo(W.ids[n], "ring")).toHaveLength(1);
  });

  it("tick escalates after ESCALATE_AFTER seconds", async () => {
    await W.q("UPDATE users SET expecting_until = now() + interval '10 minutes' WHERE id = $1", [W.ids.Ana]);
    const call = await newCall();
    await notifyCall(call.id);
    await tick(call.id, new Date(call.startedAt.getTime() + 3000));
    expect((await getCall(call.id))?.escalatedAt).toBeNull();
    await tick(call.id, new Date(call.startedAt.getTime() + 8500));
    expect((await getCall(call.id))?.escalatedAt).not.toBeNull();
    expect(pushesTo(W.ids.Cy, "ring")).toHaveLength(1);
  });

  it("marks the call missed and tells everyone when the caller hangs up", async () => {
    const call = await newCall();
    await handleHangup("cc-1");
    expect((await getCall(call.id))?.status).toBe("missed");
    expect(pushesTo(W.ids.Ana, "info")).toHaveLength(1);
  });
});

describe("fallback", () => {
  it("transfers the held call to the fallback number after BACKUP_TIMEOUT, once", async () => {
    await W.q("UPDATE household SET fallback_number = '+14155550100', backup_timeout = 20 WHERE id = 1");
    const call = await newCall();
    await tick(call.id, new Date(call.startedAt.getTime() + 10_000));
    expect((await getCall(call.id))?.status).toBe("ringing");
    await tick(call.id, new Date(call.startedAt.getTime() + 21_000));
    await tick(call.id, new Date(call.startedAt.getTime() + 22_000));
    const c = await getCall(call.id);
    expect(c?.status).toBe("fallback");
    expect(c?.method).toBe("fallback");
    expect(W.calls.filter((x) => x.action === "transfer")).toEqual([{ action: "transfer", id: "cc-1", arg: "+14155550100" }]);
    // nobody can press OPEN after the call went to the fallback
    expect(await openDoor(call.id, { id: W.ids.Ana, name: "Ana" }, "button")).toMatchObject({ ok: false });
  });

  it("does nothing without a fallback number, and recovers if the transfer fails", async () => {
    const call = await newCall();
    await tick(call.id, new Date(call.startedAt.getTime() + 30_000));
    expect((await getCall(call.id))?.status).toBe("ringing");

    await W.q("UPDATE household SET fallback_number = '+14155550100' WHERE id = 1");
    fakeTelephony({ failTransfer: true });
    expect(await startFallback(call.id)).toBe(false);
    expect((await getCall(call.id))?.status).toBe("ringing");
  });
});

describe("auto-open lifecycle", () => {
  const enable = (minutes: number, who = "Ana") =>
    W.q("INSERT INTO auto_open (id, until, enabled_by, enabled_by_name) VALUES (1, now() + make_interval(mins => $1), $2, $3) ON CONFLICT (id) DO UPDATE SET until = excluded.until, enabled_by = excluded.enabled_by, enabled_by_name = excluded.enabled_by_name", [minutes, W.ids[who], who]);

  it("opens by itself while the window is active, logs it as auto, and tells everyone", async () => {
    await enable(10);
    const call = await newCall();
    await runLifecycle(call.id, { autoOpenDelayMs: 5 });
    const c = await getCall(call.id);
    expect(c).toMatchObject({ status: "opened", method: "auto", autoByName: "Ana" });
    expect(W.calls.filter((x) => x.action === "dtmf")).toHaveLength(1);
    expect(pushesTo(W.ids.Cy, "opened")[0].payload.body).toContain("Ana");
  });

  it("does not open when the window has expired", async () => {
    await enable(10);
    await W.q("UPDATE auto_open SET until = now() - interval '1 second'");
    const call = await newCall();
    await W.q("UPDATE household SET escalate_after = 0, backup_timeout = 5 WHERE id = 1");
    // run just the first tick of the lifecycle rather than the whole wait loop
    await notifyCall(call.id);
    expect((await getCall(call.id))?.status).toBe("ringing");
    expect(W.calls.filter((x) => x.action === "dtmf")).toHaveLength(0);
  });

  it("honours a cancel during the 'one moment' delay", async () => {
    await enable(10);
    await W.q("UPDATE household SET escalate_after = 0, backup_timeout = 5 WHERE id = 1");
    const call = await newCall();
    const run = runLifecycle(call.id, { autoOpenDelayMs: 150, pollMs: 20 });
    await new Promise((r) => setTimeout(r, 40));
    await W.q("UPDATE auto_open SET until = NULL");
    await W.q("UPDATE calls SET started_at = now() - interval '200 seconds' WHERE id = $1", [call.id]); // end the wait loop quickly
    await run;
    expect(W.calls.filter((x) => x.action === "dtmf")).toHaveLength(0);
  });
});
