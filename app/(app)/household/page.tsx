"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";
import { ExpectingControl, AutoOpenControl } from "@/components/ExpectingAutoOpen";
import { NotificationsCard } from "@/components/Notifications";
import { BuzzerNumberCard } from "@/components/BuzzerNumber";
import { fmtClock } from "@/components/AppShell";

type Member = { id: string; name: string; role: string; isMe: boolean; expecting: boolean; expectingUntil: string | null; devices: number; pushDevices: number };

export default function HouseholdPage() {
  const { state, refresh } = useAppState();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [err, setErr] = useState("");
  const [qs, setQs] = useState("");
  const [qe, setQe] = useState("");
  const [saved, setSaved] = useState("");

  const load = () => api<{ members: Member[] }>("/api/household").then((r) => setMembers(r.members)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [state?.me.expectingUntil, state?.autoOpen?.until]);
  useEffect(() => { if (state) { setQs(state.me.quietStart ?? ""); setQe(state.me.quietEnd ?? ""); } }, [state?.me.quietStart, state?.me.quietEnd]);

  const saveQuiet = async (start: string, end: string) => {
    setSaved("");
    try {
      await api("/api/me", { method: "PATCH", body: { quietStart: start || null, quietEnd: end || null } });
      setSaved("Saved"); await refresh();
    } catch (e) { setSaved((e as Error).message); }
  };

  return (
    <>
      <h1 className="t-title" style={{ fontSize: "1.75rem" }}>Household</h1>
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}

      <BuzzerNumberCard />

      <section aria-label="Members">
        <ul className="panel">
          {(members ?? []).map((m) => (
            <li key={m.id} className="row">
              <span className="avatar-mark" aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontStretch: "108%" }}>{m.name}{m.isMe && <span className="t-muted"> (you)</span>}</p>
                <p className="t-muted" style={{ fontSize: "0.8125rem" }}>
                  {m.role === "admin" ? "Admin · " : ""}{m.pushDevices > 0 ? "Notifications on" : "No notifications"}
                </p>
              </div>
              {m.expecting && m.expectingUntil && <span className="badge badge-warning" style={{ fontWeight: 800 }}>Expecting</span>}
            </li>
          ))}
          {members === null && <li className="row"><span className="skeleton-line" style={{ width: "50%" }} /></li>}
        </ul>
      </section>

      <h2 className="h-section">Your phone</h2>
      <NotificationsCard />
      <ExpectingControl />
      <AutoOpenControl />

      <section className="panel" style={{ padding: "0.75rem 1rem 1rem" }} aria-labelledby="qh">
        <h3 id="qh" className="t-title" style={{ fontSize: "1.0625rem" }}>Quiet hours</h3>
        <p className="t-muted" style={{ fontSize: "0.875rem", marginBottom: "0.625rem" }}>During these hours you only get silent pings, unless you've said you're expecting someone.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <label className="label-block"><span className="t-label">From</span><input className="input w-full" type="time" value={qs} onChange={(e) => setQs(e.target.value)} /></label>
          <label className="label-block"><span className="t-label">Until</span><input className="input w-full" type="time" value={qe} onChange={(e) => setQe(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
          <button className="btn btn-primary" disabled={!!qs !== !!qe} onClick={() => saveQuiet(qs, qe)}>Save</button>
          <button className="btn btn-ghost" onClick={() => { setQs(""); setQe(""); saveQuiet("", ""); }}>Turn off</button>
          <span role="status" className="t-muted" style={{ fontSize: "0.875rem" }}>{saved}</span>
        </div>
      </section>
    </>
  );
}
