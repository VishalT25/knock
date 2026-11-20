"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";

type Entry = { id: string; at: string; status: string; method: string | null; openedByName: string | null; autoByName: string | null; escalated: boolean; secondsToOpen: number | null };

function outcome(e: Entry) {
  switch (e.status) {
    case "opened": return e.method === "auto" ? { t: `Auto-opened`, who: e.autoByName ? `window by ${e.autoByName}` : "auto-open window", tone: "success" }
      : { t: `Opened by ${e.openedByName ?? "someone"}`, who: e.secondsToOpen !== null ? `after ${e.secondsToOpen}s` : "", tone: "success" };
    case "fallback": return { t: "Went to backup number", who: "nobody tapped open", tone: "warning" };
    case "missed": return { t: "Missed", who: "visitor hung up", tone: "error" };
    case "opening": return { t: "Opening…", who: "", tone: "info" };
    case "ringing": return { t: "Ringing", who: "", tone: "info" };
    default: return { t: "Failed", who: "", tone: "error" };
  }
}
const METHOD: Record<string, string> = { auto: "Auto-open", fallback: "Fallback" }; // plain button opens are the default and get no tag

export default function LogPage() {
  const { state } = useAppState();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");
  const callKey = state?.call ? `${state.call.id}:${state.call.status}` : "none";

  useEffect(() => {
    api<{ entries: Entry[] }>("/api/log").then((r) => setEntries(r.entries)).catch((e) => setErr(e.message));
  }, [callKey]);

  const groups = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    const today = new Date().toDateString();
    const yest = new Date(Date.now() - 86400_000).toDateString();
    for (const e of entries ?? []) {
      const d = new Date(e.at);
      const ds = d.toDateString();
      const label = ds === today ? "Today" : ds === yest ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      const g = out.find((x) => x.day === label);
      if (g) g.items.push(e); else out.push({ day: label, items: [e] });
    }
    return out;
  }, [entries]);

  return (
    <>
      <h1 className="t-title" style={{ fontSize: "1.75rem" }}>Door log</h1>
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
      {entries === null && !err && <div className="skeleton-line" style={{ height: "8rem", borderRadius: "1rem" }} />}
      {entries?.length === 0 && (
        <div className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
          <p className="t-title" style={{ fontSize: "1.125rem" }}>No buzzes yet</p>
          <p className="t-muted">Every visitor, who opened the door and how, will show up here.</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.day} aria-label={g.day}>
          <h2 className="t-label" style={{ margin: "0.5rem 0.25rem" }}>{g.day}</h2>
          <ul className="panel">
            {g.items.map((e) => {
              const o = outcome(e);
              return (
                <li key={e.id} className="row" style={{ alignItems: "flex-start", padding: "0.75rem 1rem" }}>
                  <time className="t-num t-title" style={{ fontSize: "1rem", minWidth: "4.25rem", paddingTop: "0.1rem" }} dateTime={e.at}>
                    {new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </time>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontStretch: "108%" }}>{o.t}</p>
                    <p className="t-muted" style={{ fontSize: "0.875rem" }}>{[o.who, e.escalated ? "asked everyone" : ""].filter(Boolean).join(" · ")}</p>
                  </div>
                  {e.method && METHOD[e.method] && <span className="t-label" style={{ whiteSpace: "nowrap" }}>{METHOD[e.method]}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
