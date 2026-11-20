import { db } from "./db";
import { getSettings } from "./config";
import { isMock, telephony } from "./telnyx";
import { sleep } from "./calls";

export type TestSteps = { dialed?: boolean; answered?: boolean; spoke?: boolean; held?: boolean; tone?: boolean; ended?: boolean };

export async function startTestRun(to: string) {
  const q = await db();
  const rows = await q("INSERT INTO test_runs DEFAULT VALUES RETURNING id");
  const id = rows[0].id as string;
  try {
    const { callControlId } = await telephony().dial(to, `test:${id}`);
    await q("UPDATE test_runs SET call_control_id = $2, steps = steps || '{\"dialed\":true}'::jsonb WHERE id = $1", [id, callControlId]);
  } catch (e) {
    await q("UPDATE test_runs SET error = $2 WHERE id = $1", [id, (e as Error).message]);
  }
  return id;
}

async function mark(id: string, step: keyof TestSteps) {
  const q = await db();
  await q("UPDATE test_runs SET steps = steps || $2::jsonb WHERE id = $1", [id, JSON.stringify({ [step]: true })]);
}

export async function getTestRun(id: string) {
  const q = await db();
  const rows = await q("SELECT id, steps, error, created_at FROM test_runs WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Drive one webhook event of a test call. Returns work to run after the response. */
export async function handleTestEvent(runId: string, eventType: string, ccid: string): Promise<(() => Promise<void>) | null> {
  const tel = telephony();
  if (eventType === "call.answered") {
    await mark(runId, "answered");
    await tel.speak(ccid, "This is a Knock test call. Holding the line. You should hear a tone in a moment.");
    return null;
  }
  if (eventType === "call.speak.ended") {
    await mark(runId, "spoke");
    return async () => {
      await sleep(1500);
      await mark(runId, "held");
      const { unlockDigit } = await getSettings();
      await tel.sendDtmf(ccid, unlockDigit);
      await mark(runId, "tone");
      await sleep(1200);
      await tel.hangup(ccid).catch(() => {});
    };
  }
  if (eventType === "call.hangup") await mark(runId, "ended");
  return null;
}

/** Mock mode has no webhooks, so play the same script locally. */
export async function runMockTest(runId: string) {
  if (!isMock()) return;
  const q = await db();
  const rows = await q("SELECT call_control_id FROM test_runs WHERE id = $1", [runId]);
  const ccid = rows[0]?.call_control_id as string;
  await sleep(600);
  const a = await handleTestEvent(runId, "call.answered", ccid);
  await sleep(600);
  const b = await handleTestEvent(runId, "call.speak.ended", ccid);
  if (a) await a();
  if (b) await b();
  await handleTestEvent(runId, "call.hangup", ccid);
}
