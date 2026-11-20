"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";
import { IconCopy } from "@/components/Icons";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ThemeChooser } from "@/components/Theme";
import { BuzzerNumberCard } from "@/components/BuzzerNumber";
import { NotificationsCard } from "@/components/Notifications";
import { QuietHoursCard } from "@/components/QuietHours";

type Settings = { householdName: string; timezone: string; unlockDigit: string; escalateAfter: number; backupTimeout: number; fallbackNumber: string; autoOpenMax: number };
type Device = { id: string; userId: string; label: string | null; userName: string; push: boolean; lastSeen: string; isThisDevice: boolean };
type Invite = { id: string; hint: string; expiresAt: string };
type Member = { id: string; name: string; isMe: boolean };

export default function SettingsPage() {
  const { state } = useAppState();
  const router = useRouter();
  const admin = state?.me.role === "admin";
  const [name, setName] = useState(state?.me.name ?? "");
  const [nameMsg, setNameMsg] = useState("");

  const signOut = async () => { await api("/api/me", { method: "DELETE" }); router.replace("/join"); };

  return (
    <>
      <h1 className="t-title" style={{ fontSize: "1.75rem" }}>Settings</h1>
      <BuzzerNumberCard />

      <h2 className="h-section">Notifications</h2>
      <NotificationsCard />
      <QuietHoursCard />

      <h2 className="h-section">App</h2>
      <section className="panel" style={{ padding: "0.75rem 1rem 1rem", display: "grid", gap: "0.75rem" }}>
        <h2 className="t-title" style={{ fontSize: "1.0625rem" }}>Appearance</h2>
        <ThemeChooser />
      </section>
      <section className="panel" style={{ padding: "0.75rem 1rem 1rem", display: "grid", gap: "0.75rem" }}>
        <h2 className="t-title" style={{ fontSize: "1.0625rem" }}>This device</h2>
        <label className="label-block"><span className="t-label">Your name</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input className="input flex-1" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" disabled={!name.trim() || name === state?.me.name} onClick={async () => { try { await api("/api/me", { method: "PATCH", body: { name } }); setNameMsg("Saved"); } catch (e) { setNameMsg((e as Error).message); } }}>Save</button>
          </div>
        </label>
        <p role="status" className="t-muted" style={{ fontSize: "0.875rem" }}>{nameMsg}</p>
        <button className="btn btn-outline" onClick={signOut}>Sign out of this phone</button>
      </section>

      {admin ? <AdminSections /> : <p className="t-muted">Only the admin can change household settings.</p>}
    </>
  );
}

function AdminSections() {
  const { refresh } = useAppState();
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState<{ code: string; hours: number } | null>(null);
  const [hours, setHours] = useState(24);
  const [copied, setCopied] = useState(false);

  const loadPeople = () => api<{ devices: Device[]; invites: Invite[]; members: Member[] }>("/api/household").then((r) => { setDevices(r.devices); setInvites(r.invites); setMembers(r.members); });
  useEffect(() => { api<Settings>("/api/admin/settings").then(setS).catch((e) => setMsg(e.message)); loadPeople(); }, []);

  if (!s) return <div className="skeleton-line" style={{ height: "10rem", borderRadius: "1rem" }} />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const save = async () => {
    setMsg("");
    try { const r = await api<Settings>("/api/admin/settings", { method: "PATCH", body: s }); setS(r); setMsg("Saved."); await refresh(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <h2 className="h-section">Household settings</h2>
      <section className="panel" style={{ padding: "0.75rem 1rem 1rem", display: "grid", gap: "0.875rem" }}>
        <label className="label-block"><span className="t-label">Household name</span><input className="input w-full" value={s.householdName} onChange={(e) => set("householdName", e.target.value)} /></label>
        <label className="label-block"><span className="t-label">Time zone (for quiet hours)</span><input className="input w-full" value={s.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/New_York" /></label>
        <label className="label-block"><span className="t-label">Unlock digit(s) the intercom listens for</span><input className="input w-full" inputMode="text" value={s.unlockDigit} maxLength={8} onChange={(e) => set("unlockDigit", e.target.value)} /></label>
        <div className="field-row">
          <label className="label-block"><span className="t-label">Ask everyone after <span className="unit">(seconds)</span></span><input className="input w-full" type="number" inputMode="numeric" min={0} max={120} value={s.escalateAfter} onChange={(e) => set("escalateAfter", Number(e.target.value))} /></label>
          <label className="label-block"><span className="t-label">Backup call after <span className="unit">(seconds)</span></span><input className="input w-full" type="number" inputMode="numeric" min={5} max={120} value={s.backupTimeout} onChange={(e) => set("backupTimeout", Number(e.target.value))} /></label>
        </div>
        <label className="label-block"><span className="t-label">Fallback number (rings if nobody opens)</span><input className="input w-full" type="tel" value={s.fallbackNumber} onChange={(e) => set("fallbackNumber", e.target.value)} placeholder="+14155550123" /></label>
        <label className="label-block"><span className="t-label">Longest auto-open window <span className="unit">(minutes, 10 to 60)</span></span><input className="input w-full" type="number" inputMode="numeric" min={10} max={60} value={s.autoOpenMax} onChange={(e) => set("autoOpenMax", Number(e.target.value))} /></label>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={save}>Save settings</button>
          <span role="status" className="t-muted">{msg}</span>
        </div>
        <p className="t-muted" style={{ fontSize: "0.8125rem" }}>Saved values win over the server's environment variables. Telnyx keys are never shown here.</p>
      </section>

      <h2 className="h-section">Invite a roommate</h2>
      <section className="panel" style={{ padding: "0.75rem 1rem 1rem", display: "grid", gap: "0.75rem" }}>
        <div className="seg" role="group" aria-label="Invite lasts">
          {[[1, "1 hour"], [24, "1 day"], [168, "7 days"]].map(([h, l]) => (
            <button key={h as number} aria-pressed={hours === h} onClick={() => setHours(h as number)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={async () => { const r = await api<{ code: string; hours: number }>("/api/admin/invites", { body: { hours } }); setCode(r); setCopied(false); loadPeople(); }}>Make an invite code</button>
        {code && (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div className="code-block t-num" aria-label={`Invite code ${code.code}`}>{code.code}</div>
            <button className="btn btn-outline" onClick={async () => { try { await navigator.clipboard.writeText(code.code); setCopied(true); } catch { setCopied(false); } }}><IconCopy width={18} height={18} /> {copied ? "Copied" : "Copy code"}</button>
            <p className="t-muted" style={{ fontSize: "0.8125rem" }}>Works once, for {code.hours === 168 ? "7 days" : code.hours === 24 ? "24 hours" : "1 hour"}. This is the only time it is shown.</p>
          </div>
        )}
        {invites.length > 0 && (
          <div>
            <p className="t-label">Waiting to be used</p>
            <ul>{invites.map((i) => <li key={i.id} className="row" style={{ padding: "0.25rem 0" }}><span className="t-num" style={{ flex: 1 }}>{i.hint}</span><span className="t-muted" style={{ fontSize: "0.8125rem" }}>until {new Date(i.expiresAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>)}</ul>
            <button className="btn btn-sm btn-ghost" onClick={async () => { await api("/api/admin/invites", { method: "DELETE" }); setCode(null); loadPeople(); }}>Rotate: cancel all unused invites</button>
          </div>
        )}
      </section>

      <h2 className="h-section">People &amp; phones</h2>
      <section className="panel">
        <ul>
          {members.map((m) => {
            const mine = devices.filter((d) => d.userId === m.id);
            return (
              <li key={m.id} className="row" style={{ alignItems: "flex-start", flexDirection: "column", gap: "0.5rem", padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", width: "100%", alignItems: "center", gap: "0.75rem" }}>
                  <p style={{ flex: 1, fontWeight: 800 }}>{m.name}{m.isMe && <span className="t-muted"> (you)</span>}</p>
                  {!m.isMe && <ConfirmButton label="Remove person" confirmLabel="Remove them?" className="btn btn-sm btn-outline btn-error" onConfirm={async () => { await api(`/api/admin/members/${m.id}`, { method: "DELETE" }); loadPeople(); }} />}
                </div>
                {mine.map((d) => (
                  <div key={d.id} style={{ display: "flex", width: "100%", alignItems: "center", gap: "0.75rem" }}>
                    <p className="t-muted" style={{ flex: 1, fontSize: "0.875rem" }}>{d.isThisDevice ? "This phone" : d.label || "Phone"} · {d.push ? "notifications on" : "no notifications"} · seen {new Date(d.lastSeen).toLocaleDateString()}</p>
                    {!d.isThisDevice && <ConfirmButton label="Sign out phone" confirmLabel="Sure?" className="btn btn-sm btn-ghost" onConfirm={async () => { await api(`/api/admin/devices/${d.id}`, { method: "DELETE" }); loadPeople(); }} />}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <h2 className="h-section">Check the connection</h2>
      <Link className="btn btn-outline" href="/setup?recheck=1">Run checks and a test call</Link>
    </>
  );
}
