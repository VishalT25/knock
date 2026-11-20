import crypto from "node:crypto";

/* ---------------- Webhook signature (ed25519) ---------------- */

// Deterministic key pair used ONLY when TELNYX_MOCK=1 outside production, so `npm run dev:call`
// exercises the real signature path. Never accepted in production.
export const DEV_SEED = Buffer.from("knock-dev-signing-seed-0000000000".padEnd(32, "0").slice(0, 32));
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function devKeyPair() {
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, DEV_SEED]), format: "der", type: "pkcs8" });
  const publicRaw = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);
  return { privateKey, publicKeyBase64: publicRaw.toString("base64") };
}

export function isMock() {
  return process.env.TELNYX_MOCK === "1" && process.env.NODE_ENV !== "production";
}

function publicKeyBase64(): string | null {
  if (isMock() && !process.env.TELNYX_PUBLIC_KEY) return devKeyPair().publicKeyBase64;
  return process.env.TELNYX_PUBLIC_KEY?.trim() || null;
}

export function verifyTelnyxSignature(args: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey?: string | null;
  now?: number;
  toleranceSec?: number;
}): boolean {
  const key = args.publicKey ?? publicKeyBase64();
  if (!key || !args.signature || !args.timestamp) return false;
  const now = args.now ?? Date.now();
  const ts = Number(args.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > (args.toleranceSec ?? 300)) return false;
  try {
    const raw = Buffer.from(key, "base64");
    if (raw.length !== 32) return false;
    const pub = crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(`${args.timestamp}|${args.rawBody}`), pub, Buffer.from(args.signature, "base64"));
  } catch {
    return false;
  }
}

export function signForDev(rawBody: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const { privateKey } = devKeyPair();
  const sig = crypto.sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey).toString("base64");
  return { signature: sig, timestamp };
}

/* ---------------- Call Control API ---------------- */

export type Telephony = {
  answer(id: string): Promise<void>;
  speak(id: string, text: string): Promise<void>;
  sendDtmf(id: string, digits: string): Promise<void>;
  hangup(id: string): Promise<void>;
  transfer(id: string, to: string): Promise<void>;
  dial(to: string, clientState: string): Promise<{ callControlId: string }>;
};

const API = "https://api.telnyx.com/v2";

async function tx(path: string, body: unknown): Promise<any> {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("TELNYX_API_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title ?? res.statusText;
    throw new Error(`Telnyx ${path}: ${res.status} ${detail}`);
  }
  return json;
}

const enc = (id: string) => encodeURIComponent(id);

export const realTelephony: Telephony = {
  async answer(id) {
    await tx(`/calls/${enc(id)}/actions/answer`, {});
  },
  async speak(id, text) {
    await tx(`/calls/${enc(id)}/actions/speak`, { payload: text, voice: "female", language: "en-US" });
  },
  async sendDtmf(id, digits) {
    await tx(`/calls/${enc(id)}/actions/send_dtmf`, { digits, duration_millis: 300 });
  },
  async hangup(id) {
    await tx(`/calls/${enc(id)}/actions/hangup`, {});
  },
  async transfer(id, to) {
    await tx(`/calls/${enc(id)}/actions/transfer`, {
      to,
      from: process.env.TELNYX_NUMBER,
      timeout_secs: 30,
    });
  },
  async dial(to, clientState) {
    const json = await tx(`/calls`, {
      connection_id: process.env.TELNYX_CONNECTION_ID,
      to,
      from: process.env.TELNYX_NUMBER,
      client_state: Buffer.from(clientState).toString("base64"),
    });
    return { callControlId: json.data.call_control_id };
  },
};

export type MockAction = { at: number; action: string; id?: string; arg?: string };
type G = typeof globalThis & { __knockMockLog?: MockAction[]; __knockTelephony?: Telephony };
const g = globalThis as G;
export const mockLog: MockAction[] = (g.__knockMockLog ??= []);

export const mockTelephony: Telephony = {
  async answer(id) { mockLog.push({ at: Date.now(), action: "answer", id }); console.log("[telnyx:mock] answer", id); },
  async speak(id, t) { mockLog.push({ at: Date.now(), action: "speak", id, arg: t }); console.log("[telnyx:mock] speak", id, JSON.stringify(t)); },
  async sendDtmf(id, d) { mockLog.push({ at: Date.now(), action: "send_dtmf", id, arg: d }); console.log("[telnyx:mock] send_dtmf", id, d); },
  async hangup(id) { mockLog.push({ at: Date.now(), action: "hangup", id }); console.log("[telnyx:mock] hangup", id); },
  async transfer(id, to) { mockLog.push({ at: Date.now(), action: "transfer", id, arg: to }); console.log("[telnyx:mock] transfer", id, to); },
  async dial(to) {
    const callControlId = `mock-out-${Date.now()}`;
    mockLog.push({ at: Date.now(), action: "dial", id: callControlId, arg: to });
    console.log("[telnyx:mock] dial", to);
    return { callControlId };
  },
};

export function telephony(): Telephony {
  return g.__knockTelephony ?? (isMock() ? mockTelephony : realTelephony);
}
/** Tests inject a fake. */
export function setTelephonyForTests(t: Telephony | undefined) {
  g.__knockTelephony = t;
}

/** Cheap API-key check for the setup wizard. */
export async function checkApiKey(): Promise<{ ok: boolean; detail: string }> {
  if (isMock()) return { ok: true, detail: "Mock mode: Telnyx is not contacted." };
  const key = process.env.TELNYX_API_KEY;
  if (!key) return { ok: false, detail: "TELNYX_API_KEY is not set in the server environment." };
  try {
    const res = await fetch(`${API}/balance`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) return { ok: true, detail: "Telnyx accepted the API key." };
    return { ok: false, detail: `Telnyx rejected the key (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, detail: `Could not reach Telnyx: ${(e as Error).message}` };
  }
}
