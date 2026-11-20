"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { IconDoor } from "@/components/Icons";
import { NotificationsCard } from "@/components/Notifications";
import { InstallCard } from "@/components/InstallCard";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/setup").then((s) => { if (s.needsSetup) router.replace("/setup"); }).catch(() => {});
    api("/api/state").then(() => router.replace("/")).catch(() => {});
    const c = new URLSearchParams(location.search).get("code");
    if (c) setCode(c);
  }, [router]);

  if (joined) {
    return (
      <main className="screen" style={{ minHeight: "100dvh", justifyContent: "center" }}>
        <h1 className="t-title" style={{ fontSize: "1.75rem" }}>You're in, {name}.</h1>
        <p className="t-muted">One more thing: turn on notifications so your phone buzzes when someone is at the door.</p>
        <NotificationsCard />
        <button className="btn btn-primary btn-lg" onClick={() => router.replace("/")}>Open Knock</button>
      </main>
    );
  }

  return (
    <main className="screen" style={{ minHeight: "100dvh", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span className="logo-mark"><IconDoor /></span>
        <h1 className="t-title" style={{ fontSize: "1.75rem" }}>Join your household</h1>
      </div>
      <p className="t-muted">Ask the admin for an invite code. It works once.</p>
      <InstallCard variant="join" code={code || undefined} />
      <form
        style={{ display: "grid", gap: "1rem" }}
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { await api("/api/join", { body: { code, name, label: navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Android") ? "Android phone" : "Phone" } }); setJoined(true); }
          catch (x) { setErr((x as Error).message); }
          finally { setBusy(false); }
        }}
      >
        <label className="label-block"><span className="t-label">Invite code</span><input className="input w-full t-num" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KNOCK-ABCD-EFGH" autoCapitalize="characters" autoComplete="off" spellCheck={false} /></label>
        <label className="label-block"><span className="t-label">Your name (others will see it)</span><input className="input w-full" required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Joining…" : "Join"}</button>
      </form>
    </main>
  );
}
