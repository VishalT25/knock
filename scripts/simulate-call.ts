/**
 * Simulate the intercom ringing your Telnyx number, without Telnyx.
 *
 *   npm run dev:mock          # terminal 1: app with TELNYX_MOCK=1 (no real calls)
 *   npm run dev:call          # terminal 2: one incoming call; stays "held" until someone taps Open
 *   npm run dev:call -- --hangup-after 12   # visitor gives up after 12 s
 *   npm run dev:call -- --url http://localhost:3000 --id my-call-1
 *
 * Sends correctly signed webhooks (signed with the built-in dev key that the server only
 * accepts when TELNYX_MOCK=1 and NODE_ENV is not production).
 */
import { signForDev } from "../lib/telnyx";

const args = process.argv.slice(2);
const arg = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const base = (arg("url", process.env.APP_URL || "http://localhost:3000") as string).replace(/\/$/, "");
const id = arg("id", `sim-${Date.now()}`) as string;
const hangupAfter = arg("hangup-after") ? Number(arg("hangup-after")) : null;

async function send(event_type: string, extra: Record<string, unknown> = {}) {
  const body = JSON.stringify({
    data: { event_type, id: crypto.randomUUID(), occurred_at: new Date().toISOString(), payload: { call_control_id: id, direction: "incoming", from: "+15550001111", to: "+15550002222", ...extra } },
  });
  const { signature, timestamp } = signForDev(body);
  const res = await fetch(`${base}/api/telnyx`, {
    method: "POST",
    headers: { "content-type": "application/json", "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp },
    body,
  });
  console.log(`${event_type.padEnd(16)} -> HTTP ${res.status}`);
  if (!res.ok) {
    console.error(await res.text());
    if (res.status === 401) console.error("The server rejected the signature. Is it running with TELNYX_MOCK=1 (npm run dev:mock) and no TELNYX_PUBLIC_KEY?");
    process.exit(1);
  }
}

(async () => {
  console.log(`Simulating call ${id} against ${base}`);
  if (args.includes("--hangup-only")) { await send("call.hangup"); return; }
  await send("call.initiated");
  await send("call.answered");
  if (hangupAfter !== null) {
    console.log(`Visitor will hang up in ${hangupAfter}s…`);
    await new Promise((r) => setTimeout(r, hangupAfter * 1000));
    await send("call.hangup", { hangup_cause: "normal_clearing" });
  } else {
    console.log("Call is being held. Open the app and tap OPEN DOOR (or let auto-open / fallback fire).");
    console.log(`To end it: npm run dev:call -- --id ${id} --hangup-only`);
  }
})();
