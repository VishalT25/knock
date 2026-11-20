"use client";
import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "other";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-bar away; we offer our own button
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** Facebook, Instagram, TikTok, Snapchat, LINE, WeChat and similar in-app browsers can't add to the Home Screen. */
export const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|BytedanceWebview|Line\/|MicroMessenger|Twitter|LinkedInApp|Pinterest/i.test(navigator.userAgent);

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  listeners.forEach((l) => l());
  return outcome;
}

/** Everything the install screens need, kept current as the browser's install prompt arrives. */
export function useInstall() {
  const [s, setS] = useState<{ ready: boolean; platform: Platform; standalone: boolean; inApp: boolean; canPrompt: boolean }>({ ready: false, platform: "other", standalone: false, inApp: false, canPrompt: false });
  useEffect(() => {
    const read = () => setS({ ready: true, platform: detectPlatform(), standalone: isStandalone(), inApp: inAppBrowser(), canPrompt: !!deferred });
    read();
    listeners.add(read);
    return () => { listeners.delete(read); };
  }, []);
  return s;
}
