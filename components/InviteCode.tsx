"use client";
import { useEffect, useState } from "react";
import { IconCopy } from "./Icons";

const lasts = (h: number) => (h === 168 ? "7 days" : h === 24 ? "24 hours" : h === 1 ? "1 hour" : `${h} hours`);

/**
 * A fresh invite code plus everything a roommate needs to use it: Knock's address (the link) and the code itself.
 * The code alone isn't enough, because nobody knows where to type it, so the primary action copies a whole message.
 */
export function InviteCode({ code, hours = 24 }: { code: string; hours?: number }) {
  const [origin, setOrigin] = useState("");
  const [done, setDone] = useState<"message" | "code" | null>(null);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setOrigin(location.origin); setCanShare(typeof navigator.share === "function"); }, []);
  useEffect(() => setDone(null), [code]);

  const link = `${origin}/join?code=${encodeURIComponent(code)}`;
  const message = `Join our door buzzer on Knock.\n\n1. Open this link on your phone (Safari on iPhone, Chrome on Android):\n${link}\n2. Follow the steps to add it to your Home Screen.\n\nYour invite code: ${code}\nIt works once and expires in ${lasts(hours)}.`;

  const copy = async (what: "message" | "code") => {
    try { await navigator.clipboard.writeText(what === "message" ? message : code); setDone(what); setTimeout(() => setDone(null), 2500); } catch { setDone(null); }
  };

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div className="code-block t-num" aria-label={`Invite code ${code}`}>{code}</div>
      <p className="t-muted" style={{ fontSize: "0.875rem" }}>
        Your roommate needs two things: <strong>this app's address</strong> ({origin ? origin.replace(/^https?:\/\//, "") : "your Knock link"}) and <strong>the code</strong>. The message below has both, and they open the link on their phone.
      </p>
      <button className="btn btn-primary" onClick={() => copy("message")}><IconCopy width={18} height={18} /> {done === "message" ? "Copied. Paste it into a text" : "Copy invite message"}</button>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {canShare && <button className="btn btn-sm btn-outline" onClick={() => navigator.share({ title: "Join Knock", text: message }).catch(() => {})}>Share…</button>}
        <button className="btn btn-sm btn-ghost" onClick={() => copy("code")}>{done === "code" ? "Copied" : "Copy code only"}</button>
      </div>
      <p className="t-muted" style={{ fontSize: "0.8125rem" }}>Works once, for {lasts(hours)}. This is the only time the code is shown.</p>
    </div>
  );
}
