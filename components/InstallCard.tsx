"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useInstall } from "@/lib/client/install";
import { IconDownload, IconX } from "./Icons";

const KEY = "knock-install-dismissed";
const SNOOZE_MS = 14 * 24 * 3600 * 1000;

/** A prompt to add Knock to the Home Screen. Renders nothing once it is installed, or on a computer. */
export function InstallCard({ variant, code }: { variant: "banner" | "settings" | "join"; code?: string }) {
  const inst = useInstall();
  const [hidden, setHidden] = useState(variant === "banner");
  useEffect(() => {
    if (variant !== "banner") return;
    try { const t = Number(localStorage.getItem(KEY) || 0); setHidden(Date.now() - t < SNOOZE_MS); } catch { setHidden(false); }
  }, [variant]);

  if (!inst.ready || inst.standalone || inst.platform === "other" || hidden) return null;
  if (variant === "settings" && inst.platform === "ios") return null; // the notifications card below already links to the install guide
  const ios = inst.platform === "ios";
  const href = code ? `/install?code=${encodeURIComponent(code)}` : "/install";
  const title = variant === "join" && ios ? "Install Knock first" : "Add Knock to your Home Screen";
  const text =
    variant === "join" && ios ? "The Home Screen copy keeps its own sign-in, so add it first, then join there."
    : ios ? "Needed for notifications on iPhone."
    : "Opens in one tap and can buzz you when the app is closed.";

  return (
    <div className="notice" data-tone={ios ? "warn" : undefined} role="region" aria-label="Install Knock">
      <IconDownload />
      <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
        <strong className="t-title" style={{ fontSize: "1rem" }}>{title}</strong>
        <p>{text}</p>
        <div><Link className="btn btn-sm btn-primary" href={href}>Show me how</Link></div>
      </div>
      {variant === "banner" && (
        <button className="icon-btn" aria-label="Not now" style={{ marginTop: "-0.5rem", marginRight: "-0.5rem" }} onClick={() => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} setHidden(true); }}>
          <IconX />
        </button>
      )}
    </div>
  );
}
