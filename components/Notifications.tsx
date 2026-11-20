"use client";
import { useEffect, useState } from "react";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/client/push";
import { useAppState } from "@/lib/client/useAppState";
import { IconBell, IconBellOff } from "./Icons";

/** Enable/disable push for this device, with every failure explained. */
export function NotificationsCard({ onEnabled }: { onEnabled?: () => void }) {
  const { state } = useAppState();
  const [st, setSt] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { pushStatus().then(setSt).catch(() => {}); }, []);
  if (!st) return null;

  const turnOn = async () => {
    setBusy(true); setErr("");
    try { const r = await enablePush(); setSt(r); if (r.kind === "on") onEnabled?.(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true);
    try { await disablePush(); setSt(await pushStatus()); } finally { setBusy(false); }
  };

  const tone = st.kind === "on" ? "ok" : st.kind === "off" ? "warn" : "error";
  return (
    <div className="notice" data-tone={tone}>
      {st.kind === "on" ? <IconBell /> : <IconBellOff />}
      <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
        <strong className="t-title" style={{ fontSize: "1rem" }}>
          {st.kind === "on" ? "Notifications are on for this phone" : st.kind === "off" ? "Turn on notifications" : st.kind === "denied" ? "Notifications are blocked" : "Notifications can't be turned on here"}
        </strong>
        {st.kind === "denied" && <p>Open your phone's Settings, find Knock (or this browser), and allow notifications. Then come back and reload.</p>}
        {(st.kind === "needs-install" || st.kind === "unsupported") && <p>{st.reason}</p>}
        {st.kind === "off" && <p>Without them you won't hear the door when the app is closed.{state && !state.pushConfigured && " The server has no push keys yet; ask the admin."}</p>}
        {err && <p role="alert" style={{ color: "var(--color-error)" }}>{err}</p>}
        {st.kind === "off" && <button className="btn btn-primary" disabled={busy} onClick={turnOn}>{busy ? "Asking…" : "Enable notifications"}</button>}
        {st.kind === "on" && <button className="btn btn-sm btn-ghost" style={{ justifySelf: "start" }} disabled={busy} onClick={turnOff}>Turn off on this phone</button>}
      </div>
    </div>
  );
}
