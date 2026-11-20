"use client";
import { api } from "./api";

export type PushStatus =
  | { kind: "unsupported"; reason: string }
  | { kind: "needs-install"; reason: string }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" };

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** Checks that need no waiting. */
function syncProblem(): PushStatus | null {
  if (isIOS() && !isStandalone()) {
    return { kind: "needs-install", reason: "On iPhone, add Knock to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn on notifications." };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { kind: "unsupported", reason: "This browser can't receive push notifications. Try Chrome on Android or Safari 16.4+ on iPhone." };
  }
  if (Notification.permission === "denied") return { kind: "denied" };
  return null;
}

export async function pushStatus(): Promise<PushStatus> {
  const p = syncProblem();
  if (p) return p;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") return { kind: "on" };
  } catch {}
  return { kind: "off" };
}

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// The server key is fetched ahead of the tap. Safari only allows the permission prompt directly inside a tap,
// so nothing awaitable may happen between the tap and Notification.requestPermission().
let keyInfo: { publicKey: string | null; problem: string | null } | null = null;
export async function prefetchPushKey() {
  try { keyInfo = await api<{ publicKey: string | null; problem: string | null }>("/api/push"); } catch {}
}

/** Call this directly from a click handler. */
export function enablePush(): Promise<PushStatus> {
  const early = syncProblem();
  if (early) return Promise.resolve(early);
  const asked = Notification.requestPermission(); // first thing, still inside the tap
  return (async () => {
    const perm = await asked;
    if (perm !== "granted") return { kind: "denied" } as PushStatus;
    if (!keyInfo) await prefetchPushKey();
    if (!keyInfo?.publicKey) throw new Error(`Notifications aren't set up on the server yet. ${keyInfo?.problem ?? ""} Ask the admin to fix it in Vercel and redeploy.`.trim());
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    let sub = existing;
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(keyInfo.publicKey) });
      } catch (e) {
        throw new Error(`Your phone refused to subscribe: ${(e as Error).message}`);
      }
    }
    await api("/api/push", { method: "POST", body: { subscription: sub.toJSON() } });
    return { kind: "on" } as PushStatus;
  })();
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  await api("/api/push", { method: "DELETE" });
}

/** Sends a real push to this phone through the server and reports exactly what the push service said. */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  try {
    await api("/api/push/test", { method: "POST", body: {} });
    return { ok: true, message: "Sent. A notification should appear in a few seconds." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
