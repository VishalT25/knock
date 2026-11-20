"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";

/** For someone who isn't an admin but owns the deployment: enter the setup password to become one. */
export function ClaimAdmin() {
  const { refresh } = useAppState();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <details className="panel" style={{ padding: "0.75rem 1rem" }}>
      <summary style={{ fontWeight: 800, cursor: "pointer", minHeight: "2.75rem", display: "flex", alignItems: "center" }}>Make this phone an admin</summary>
      <form
        style={{ display: "grid", gap: "0.75rem", paddingBottom: "0.25rem" }}
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { await api("/api/me/claim-admin", { body: { token } }); setToken(""); await refresh(); }
          catch (x) { setErr((x as Error).message); }
          finally { setBusy(false); }
        }}
      >
        <p className="t-muted" style={{ fontSize: "0.875rem" }}>If you own this Knock, enter the setup password you chose on Vercel (the <code>SETUP_TOKEN</code>). Use it when the admin is signed in on another browser, or when nobody is an admin.</p>
        <label className="label-block">
          <span className="t-label">Setup password</span>
          <input className="input w-full" type="password" required autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Checking…" : "Make me an admin"}</button>
      </form>
    </details>
  );
}
