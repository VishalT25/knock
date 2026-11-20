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

export async function pushStatus(): Promise<PushStatus> {
  if (isIOS() && !isStandalone()) {
    return { kind: "needs-install", reason: "On iPhone, add Knock to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn on notifications." };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { kind: "unsupported", reason: "This browser can't receive push notifications. Try Chrome on Android or Safari 16.4+ on iPhone." };
  }
  if (Notification.permission === "denied") return { kind: "denied" };
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

export async function enablePush(): Promise<PushStatus> {
  const st = await pushStatus();
  if (st.kind === "unsupported" || st.kind === "needs-install" || st.kind === "denied") return st;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { kind: "denied" };
  const { publicKey } = await api<{ publicKey: string | null }>("/api/push");
  if (!publicKey) throw new Error("The server has no VAPID keys configured yet. Ask the admin to set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  await api("/api/push", { method: "POST", body: { subscription: sub.toJSON() } });
  return { kind: "on" };
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  await api("/api/push", { method: "DELETE" });
}
