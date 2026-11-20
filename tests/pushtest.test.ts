import { afterEach, describe, expect, it } from "vitest";
import { sendToSubscription, setPushSenderForTests } from "@/lib/push";

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
