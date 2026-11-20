"use client";
import { useState } from "react";
import { useAppState } from "@/lib/client/useAppState";
import { api } from "@/lib/client/api";
import { fmtClock, useCountdown } from "./AppShell";
import { IconChevron } from "./Icons";

const EXPECT = [15, 45, 90];
const AUTO = [10, 20, 30, 60];

export function ExpectingControl({ compact = false }: { compact?: boolean }) {
  const { state, skew, refresh } = useAppState();
  const left = useCountdown(state?.me.expectingUntil, skew);
  const [minutes, setMinutes] = useState(45);
  const [err, setErr] = useState("");
  if (!state) return null;
  const on = left > 0;
  const set = async (next: boolean) => {
    setErr("");
    try { await api("/api/me/expecting", { body: next ? { minutes } : { on: false } }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <section className={compact ? "inset-group" : "panel"} aria-labelledby="exp-h" style={{ padding: compact ? "0.25rem 0 0.25rem" : "0.75rem 1rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minHeight: "3rem" }}>
        <div style={{ flex: 1 }}>
          <h3 id="exp-h" className="t-title" style={{ fontSize: "1.0625rem" }}>I'm expecting someone</h3>
          {(!compact || on) && (
            <p className="t-muted" style={{ fontSize: "0.875rem" }}>
              {on ? <>You get the loud buzz first · <span className="t-num">{fmtClock(left)}</span> left</> : "You get the loud buzz first; others get a quiet ping."}
            </p>
          )}
        </div>
        <label className="toggle-hit"><input type="checkbox" className="toggle toggle-primary" checked={on} onChange={(e) => set(e.target.checked)} aria-labelledby="exp-h" /></label>
      </div>
      {!on && (
        <div className="seg" role="group" aria-label="How long" style={{ marginTop: "0.5rem" }}>
          {EXPECT.map((m) => (
            <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
          ))}
        </div>
      )}
      {err && <p role="alert" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{err}</p>}
    </section>
  );
}

export function AutoOpenControl({ compact = false }: { compact?: boolean }) {
  const { state, refresh } = useAppState();
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  if (!state) return null;
  const max = state.household.autoOpenMax;
  const active = !!state.autoOpen;
  const start = async (m: number) => {
    setBusy(m); setErr("");
    try { await api("/api/auto-open", { body: { minutes: m } }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };
  return (
    <section className={compact ? "inset-group" : "panel"} aria-labelledby="ao-h" style={{ padding: compact ? "0.25rem 0 0.25rem" : "0.75rem 1rem 1rem" }}>
      <h3 id="ao-h" className="t-title" style={{ fontSize: "1.0625rem" }}>Auto-open the door</h3>
      <p className="t-muted" style={{ fontSize: "0.875rem", marginBottom: "0.625rem" }}>
        {compact ? (active ? "On. Cancel it from the yellow bar." : "Opens every buzz by itself. Everyone is told.") : active ? "Already on. Cancel it from the yellow bar, or restart with a new time." : "Every buzz opens by itself, with no tap, for a while. Everyone is told. Off by default."}
      </p>
      <div className="seg" role="group" aria-label="Auto-open for">
        {AUTO.map((m) => (
          <button key={m} disabled={m > max || busy !== null} onClick={() => start(m)} aria-label={`Auto-open for ${m} minutes`}>
            {busy === m ? "…" : `${m}m`}
          </button>
        ))}
      </div>
      {err && <p role="alert" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{err}</p>}
    </section>
  );
}

/** Both controls behind one calm row. Collapsed it only shows what is currently on. */
export function QuickControls() {
  const { state, skew } = useAppState();
  const [open, setOpen] = useState(false);
  const expLeft = useCountdown(state?.me.expectingUntil, skew);
  const autoLeft = useCountdown(state?.autoOpen?.until, skew);
  if (!state) return null;
  const bits = [expLeft > 0 ? `Expecting · ${fmtClock(expLeft)}` : "", autoLeft > 0 ? `Auto-open · ${fmtClock(autoLeft)}` : ""].filter(Boolean);
  return (
    <section className="panel disclosure" data-open={open}>
      <button className="disclosure-head live" aria-expanded={open} aria-controls="qc-body" onClick={() => setOpen((o) => !o)}>
        <span style={{ flex: 1, textAlign: "left" }}>
          <span className="t-title" style={{ fontSize: "1.0625rem", display: "block" }}>Expecting &amp; auto-open</span>
          <span className="t-muted" style={{ fontSize: "0.875rem", display: "block" }}>{bits.length ? bits.join("  ·  ") : "Both off"}</span>
        </span>
        <IconChevron className="chev" />
      </button>
      <div id="qc-body" className="disclosure-body" role="region" aria-hidden={!open} inert={!open}>
        <div className="disclosure-inner">
          <ExpectingControl compact />
          <AutoOpenControl compact />
        </div>
      </div>
    </section>
  );
}
