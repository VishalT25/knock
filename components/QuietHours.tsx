"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";

/** Per-person quiet hours: silent pings only, unless you're expecting someone. */
export function QuietHoursCard() {
  const { state, refresh } = useAppState();
  const [qs, setQs] = useState("");
  const [qe, setQe] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => { if (state) { setQs(state.me.quietStart ?? ""); setQe(state.me.quietEnd ?? ""); } }, [state?.me.quietStart, state?.me.quietEnd]);

  const save = async (start: string, end: string) => {
    setSaved("");
    try {
      await api("/api/me", { method: "PATCH", body: { quietStart: start || null, quietEnd: end || null } });
      setSaved("Saved"); await refresh();
    } catch (e) { setSaved((e as Error).message); }
  };

  return (
    <section className="panel" style={{ padding: "0.75rem 1rem 1rem" }} aria-labelledby="qh">
      <h3 id="qh" className="t-title" style={{ fontSize: "1.0625rem" }}>Quiet hours</h3>
      <p className="t-muted" style={{ fontSize: "0.875rem", marginBottom: "0.625rem" }}>During these hours you only get silent pings, unless you've said you're expecting someone.</p>
      <div className="field-row">
        <label className="label-block"><span className="t-label">From</span><input className="input w-full" type="time" value={qs} onChange={(e) => setQs(e.target.value)} /></label>
        <label className="label-block"><span className="t-label">Until</span><input className="input w-full" type="time" value={qe} onChange={(e) => setQe(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
        <button className="btn btn-primary" disabled={!!qs !== !!qe} onClick={() => save(qs, qe)}>Save</button>
        <button className="btn btn-ghost" onClick={() => { setQs(""); setQe(""); save("", ""); }}>Turn off</button>
        <span role="status" className="t-muted" style={{ fontSize: "0.875rem" }}>{saved}</span>
      </div>
    </section>
  );
}
