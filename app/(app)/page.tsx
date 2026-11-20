"use client";
import { useEffect, useRef, useState } from "react";
import { useAppState, } from "@/lib/client/useAppState";
import { api, ApiError, haptic } from "@/lib/client/api";
import { pushStatus, type PushStatus } from "@/lib/client/push";
import { AutoOpenBanner, fmtClock } from "@/components/AppShell";
import { SignGlyph, SleepGlyph, IconBellOff } from "@/components/Icons";
import { QuickControls } from "@/components/ExpectingAutoOpen";
import Link from "next/link";

type Phase = "idle" | "ringing" | "opening" | "opened" | "missed" | "fallback" | "error";

export default function OpenScreen() {
  const { state, refresh, skew } = useAppState();
  const call = state?.call ?? null;
  const [local, setLocal] = useState<"opening" | "error" | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [push, setPush] = useState<PushStatus | null>(null);
  const lastRing = useRef<string | null>(null);

  useEffect(() => { pushStatus().then(setPush).catch(() => {}); }, []);

  // Reset optimistic state whenever the server moves on.
  useEffect(() => {
    if (!call || call.status !== "ringing") setLocal(null);
  }, [call?.id, call?.status]);

  // Haptic pulse when a new buzz reaches this screen.
  useEffect(() => {
    if (call?.status === "ringing" && lastRing.current !== call.id) {
      lastRing.current = call.id;
      if (call.myMode !== "quiet") haptic([200, 80, 200, 80, 400]);
    }
    if (call?.status === "opened" && lastRing.current === call.id) {
      haptic([30, 40, 90]);
      lastRing.current = null;
    }
  }, [call?.id, call?.status, call?.myMode]);

  const phase: Phase = !call
    ? "idle"
    : local === "opening" && call.status === "ringing"
      ? "opening"
      : local === "error" && call.status === "ringing"
        ? "error"
        : call.status === "ringing" ? "ringing"
        : call.status === "opening" ? "opening"
        : call.status === "opened" ? "opened"
        : call.status === "fallback" ? "fallback"
        : "missed";

  const open = async () => {
    if (!call || phase !== "ringing") return;
    haptic(40);
    setLocal("opening");
    setErrMsg("");
    try {
      await api("/api/open", { body: { callId: call.id } });
      await refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 || err.status === 410) { setLocal(null); await refresh(); }
      else { setLocal("error"); setErrMsg(err.message); haptic([60, 60, 60]); }
    }
  };

  const notMine = async () => {
    if (!call) return;
    haptic(20);
    try { await api("/api/escalate", { body: { callId: call.id } }); await refresh(); } catch {}
  };

  const [, force] = useState(0);
  useEffect(() => {
    if (phase !== "ringing") return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  const waited = call ? Math.max(0, Math.floor((Date.now() + skew - new Date(call.startedAt).getTime()) / 1000)) : 0;

  const lcdMain =
    phase === "idle" ? "Standby" :
    phase === "ringing" ? "At the door" :
    phase === "opening" ? "Opening…" :
    phase === "opened" ? "Opened" :
    phase === "fallback" ? "Backup called" : phase === "error" ? "Not opened" : "Visitor left";
  const lcdSub =
    phase === "idle" ? "" :
    phase === "ringing" ? (call?.myMode === "quiet" ? "Quiet ping: someone else was asked first. You can still open it." : "Tap OPEN DOOR to let them in.") :
    phase === "opening" ? "Sending the unlock tone." :
    phase === "opened" ? (call?.method === "auto" ? "Auto-open let them in." : `Opened by ${call?.openedByName ?? "someone"}.`) :
    phase === "fallback" ? "Nobody opened it, so the backup number is ringing." :
    phase === "error" ? errMsg || call?.error || "Couldn't send the tone. Tap to try again." : "They hung up before anyone opened it.";
  const keyWord =
    phase === "idle" ? "No one at the door" :
    phase === "ringing" || phase === "error" ? "Open door" :
    phase === "opening" ? "Opening" :
    phase === "opened" ? "Door open" :
    phase === "fallback" ? "Backup has it" : "Nothing to open";
  const tag =
    phase === "ringing" ? `Waiting ${fmtClock(waited)}` : phase === "idle" ? "Buzzer status" : phase === "opening" ? "Working" :
    phase === "opened" ? "Done" : phase === "fallback" ? "Backup ringing" : phase === "error" ? "Failed" : "Ended";

  const lit = phase === "ringing" || phase === "error";
  const stateAttr = phase;

  return (
    <>
      <h1 className="sr-only">Door buzzer</h1>
      <AutoOpenBanner sticky />
      <div className="sr-only" aria-live="assertive" role="status">{phase === "ringing" ? "Someone is at the door." : phase === "opened" ? lcdSub : ""}</div>

      {push && (push.kind !== "on") && (
        <div className="notice" data-tone={push.kind === "denied" ? "error" : "warn"} role="status">
          <IconBellOff />
          <div style={{ fontSize: "0.9375rem" }}>
            <strong>{push.kind === "denied" ? "Notifications are blocked." : "Notifications are off on this phone."}</strong>{" "}
            {push.kind === "denied"
              ? "Allow them for Knock in your phone's Settings, or you won't hear the door."
              : push.kind === "off" ? <>You won't hear the door. <Link href="/household" style={{ fontWeight: 800 }}>Turn them on</Link>.</> : push.reason}
          </div>
        </div>
      )}

      <div className="device">
        <div className="lcd" data-state={stateAttr}>
          <div className="lcd-top"><span className="t-num" aria-hidden={phase === "ringing"}>{tag}</span></div>
          <div className="lcd-main" key={phase}>{lcdMain}</div>
          {lcdSub && <div className="lcd-sub" key={`s-${phase}`}>{lcdSub}</div>}
        </div>
        <button
          className="key"
          data-state={stateAttr}
          onClick={lit ? open : undefined}
          aria-disabled={!lit}
          aria-label={lit ? "Open door" : phase === "idle" ? "Nobody is at the door" : keyWord}
        >
          {phase === "idle" ? <SleepGlyph className="glyph sleep" /> : (<><SignGlyph className="glyph" /><span className="word" key={phase}>{keyWord}</span></>)}
        </button>
        {phase === "ringing" && call?.myMode !== "quiet" && !call?.escalated && (
          <button className="btn-key" onClick={notMine}>Not mine: ask everyone</button>
        )}
        {phase === "ringing" && call?.escalated && <p className="t-label" style={{ textAlign: "center" }}>Everyone has been notified</p>}
      </div>

      {(phase === "idle" || phase === "opened" || phase === "missed") && (
        <QuickControls />
      )}
    </>
  );
}
