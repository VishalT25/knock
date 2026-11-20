import { resetDbForTests } from "@/lib/db";
import { setTelephonyForTests, type Telephony } from "@/lib/telnyx";
import { setPushSenderForTests, sentLog } from "@/lib/push";

export type Calls = { action: string; id?: string; arg?: string }[];

export function fakeTelephony(opts: { failDtmf?: boolean; failTransfer?: boolean } = {}) {
  const calls: Calls = [];
  const t: Telephony = {
    async answer(id) { calls.push({ action: "answer", id }); },
    async speak(id, arg) { calls.push({ action: "speak", id, arg }); },
    async sendDtmf(id, arg) {
      if (opts.failDtmf) throw new Error("telnyx down");
      calls.push({ action: "dtmf", id, arg });
    },
    async hangup(id) { calls.push({ action: "hangup", id }); },
    async transfer(id, arg) {
      if (opts.failTransfer) throw new Error("no route");
      calls.push({ action: "transfer", id, arg });
    },
    async dial(to) { calls.push({ action: "dial", arg: to }); return { callControlId: "out-1" }; },
  };
  setTelephonyForTests(t);
  return calls;
}

export async function freshWorld(users: { name: string; role?: string; push?: boolean }[] = [{ name: "Ana", role: "admin" }, { name: "Ben" }, { name: "Cy" }]) {
  const q = await resetDbForTests();
  delete process.env.FALLBACK_NUMBER;
  await q("INSERT INTO household (id, name, timezone) VALUES (1, 'Test House', 'UTC')");
  const ids: Record<string, string> = {};
  for (const u of users) {
    const r = await q("INSERT INTO users (name, role) VALUES ($1, $2) RETURNING id", [u.name, u.role ?? "member"]);
    ids[u.name] = r[0].id;
    if (u.push !== false) {
      await q("INSERT INTO devices (user_id, token_hash, push_sub) VALUES ($1, $2, $3::jsonb)", [r[0].id, `t-${u.name}`, JSON.stringify({ endpoint: `https://push/${u.name}`, keys: { p256dh: "x", auth: "y" } })]);
    }
  }
  sentLog.length = 0;
  setPushSenderForTests(async () => {});
  const calls = fakeTelephony();
  return { q, ids, calls };
}

export function pushesTo(userId: string, kind?: string) {
  return sentLog.filter((s) => s.userId === userId && (!kind || s.payload.kind === kind));
}
