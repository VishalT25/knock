"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { IconAlert, IconBook, IconCheck, IconDoor, IconX, IconClock } from "@/components/Icons";
import { NotificationsCard } from "@/components/Notifications";

type Check = { id: string; label: string; ok: boolean; detail: string };
type Steps = { dialed?: boolean; answered?: boolean; spoke?: boolean; held?: boolean; tone?: boolean; ended?: boolean };

const STEP_NAMES = ["Household", "Checks", "Test call", "Phones"];
const DOCS = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://knockbuzzer.app/docs";
/** The guide page that matches each setup step. */
const GUIDE: { path: string; what: string }[] = [
  { path: "first-run", what: "Fill this in, then Knock checks your Telnyx connection." },
  { path: "telnyx/connect", what: "Red crosses mean a Telnyx key or setting is missing. The guide shows where each one goes." },
  { path: "first-run", what: "Knock calls your phone to prove the whole line works." },
  { path: "roommates", what: "Invite your roommates and put Knock on their Home Screens." },
];

export default function SetupPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<number | null>(null);
  const [info, setInfo] = useState<{ tokenRequired: boolean; tokenMissingOnServer: boolean; mock: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const s = await api<{ needsSetup: boolean; tokenRequired: boolean; tokenMissingOnServer: boolean; mock: boolean }>("/api/setup");
      setInfo(s);
      if (s.needsSetup) return setStep(0);
      try {
        const st = await api<{ me: { role: string } }>("/api/state");
        if (st.me.role !== "admin") return router.replace("/");
        setStep(1);
      } catch {
        router.replace("/join");
      }
    })().catch(() => setStep(0));
  }, [router, params]);

  if (step === null || !info) return <main className="screen" aria-busy="true"><div className="skeleton-line" style={{ height: "12rem", borderRadius: "1.5rem", marginTop: "3rem" }} /></main>;

  return (
    <main className="screen" style={{ minHeight: "100dvh", paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span className="logo-mark"><IconDoor /></span>
        <h1 className="t-title" style={{ fontSize: "1.5rem" }}>Set up Knock</h1>
      </header>
      <ol aria-label="Progress" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.375rem" }}>
        {STEP_NAMES.map((n, i) => (
          <li key={n} aria-current={i === step ? "step" : undefined} style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ height: "0.3rem", borderRadius: "1rem", background: i <= step ? "var(--color-primary)" : "var(--color-base-300)" }} />
            <span className="t-label" style={{ color: i === step ? "var(--color-base-content)" : undefined }}>{n}</span>
          </li>
        ))}
      </ol>
      <a className="notice guide-link" href={`${DOCS}/${GUIDE[step].path}`} target="_blank" rel="noopener noreferrer">
        <IconBook />
        <span><strong>Follow the setup guide.</strong> {GUIDE[step].what} <u>Open the guide</u></span>
      </a>
      {info.mock && <div className="notice" data-tone="warn">Mock mode: no real Telnyx calls are made. This is for local development.</div>}
      {step === 0 && <StepHousehold info={info} onDone={() => setStep(1)} />}
      {step === 1 && <StepChecks onNext={() => setStep(2)} />}
      {step === 2 && <StepTest onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepPhones onDone={() => router.replace("/")} />}
    </main>
  );
}

function StepHousehold({ info, onDone }: { info: { tokenRequired: boolean; tokenMissingOnServer: boolean }; onDone: () => void }) {
  const [householdName, setH] = useState("");
  const [adminName, setA] = useState("");
  const [token, setT] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form
      style={{ display: "grid", gap: "1rem" }}
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        try { await api("/api/setup", { body: { householdName, adminName, token, timezone: tz, label: "Admin phone" } }); onDone(); }
        catch (x) { setErr((x as Error).message); }
        finally { setBusy(false); }
      }}
    >
      <p className="t-muted">You'll be the admin. Roommates join later with an invite code, no accounts or passwords.</p>
      {info.tokenMissingOnServer && <div className="notice" data-tone="error" role="alert"><IconAlert /><span>The server has no <code>SETUP_TOKEN</code> set. Add one in your environment variables and redeploy before continuing.</span></div>}
      <label className="label-block"><span className="t-label">Household name</span><input className="input w-full" required maxLength={32} value={householdName} onChange={(e) => setH(e.target.value)} placeholder="Flat 4B" autoComplete="off" /></label>
      <label className="label-block"><span className="t-label">Your name</span><input className="input w-full" required maxLength={32} value={adminName} onChange={(e) => setA(e.target.value)} placeholder="Sam" autoComplete="given-name" /></label>
      {info.tokenRequired && <label className="label-block"><span className="t-label">Setup password</span><span className="t-muted" style={{ fontSize: "0.875rem" }}>The <code>SETUP_TOKEN</code> you chose when you deployed on Vercel. Forgot it? Vercel, your project, Settings, Environment Variables.</span><input className="input w-full" type="password" required value={token} onChange={(e) => setT(e.target.value)} autoComplete="off" /></label>}
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Creating…" : "Create household"}</button>
    </form>
  );
}

function StepChecks({ onNext }: { onNext: () => void }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [err, setErr] = useState("");
  const run = useCallback(() => {
    setChecks(null); setErr("");
    api<{ checks: Check[] }>("/api/setup/checks").then((r) => setChecks(r.checks)).catch((e) => setErr(e.message));
  }, []);
  useEffect(run, [run]);
  const allOk = checks?.every((c) => c.ok);
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <p className="t-muted">Knock checks that Telnyx, the webhook and push notifications are wired up.</p>
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
      <ul className="panel checklist" aria-busy={!checks}>
        {!checks && !err && [0, 1, 2, 3, 4].map((i) => <li key={i}><span className="skeleton-line" style={{ width: `${40 + i * 8}%` }} /></li>)}
        {checks?.map((c) => (
          <li key={c.id}>
            <span style={{ color: c.ok ? "var(--color-success)" : "var(--color-error)", flex: "none", marginTop: "0.1rem" }}>{c.ok ? <IconCheck width={22} height={22} /> : <IconX width={22} height={22} />}</span>
            <div><p style={{ fontWeight: 800 }}>{c.label}</p><p className="t-muted" style={{ fontSize: "0.875rem" }}>{c.detail}</p></div>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="btn btn-outline" onClick={run}>Check again</button>
        <button className="btn btn-primary flex-1" onClick={onNext}>{allOk ? "Next: test call" : "Continue anyway"}</button>
      </div>
    </div>
  );
}

const TEST_STEPS: [keyof Steps, string][] = [["dialed", "Calling your phone"], ["answered", "You answered; Knock picked up"], ["spoke", "Knock spoke to you"], ["held", "Held the line quietly"], ["tone", "Sent the unlock tone"], ["ended", "Hung up cleanly"]];

function StepTest({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [to, setTo] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Steps>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!runId) return;
    const poll = async () => {
      try {
        const r = await api<{ steps: Steps; error: string | null }>(`/api/setup/test-call?id=${runId}`);
        setSteps(r.steps);
        if (r.error) { setErr(r.error); stop(); }
        if (r.steps.ended) stop();
      } catch (e) { setErr((e as Error).message); stop(); }
    };
    const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setBusy(false); };
    timer.current = setInterval(poll, 1000);
    poll();
    return stop;
  }, [runId]);

  const start = async () => {
    setErr(""); setSteps({}); setBusy(true);
    try { const r = await api<{ id: string }>("/api/setup/test-call", { body: { to } }); setRunId(r.id); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const passed = !!steps.tone && !!steps.ended;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <p className="t-muted">Knock calls your phone, picks up, talks, holds the line and plays the unlock tone. Answer it and listen for the beep.</p>
      <label className="label-block"><span className="t-label">Your mobile number</span><input className="input w-full" type="tel" inputMode="tel" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+14155550123" autoComplete="tel" /></label>
      <button className="btn btn-primary" disabled={busy || !to} onClick={start}>{busy ? "Calling…" : runId ? "Call me again" : "Call me"}</button>
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}
      {runId && (
        <ul className="panel checklist" aria-live="polite">
          {TEST_STEPS.map(([k, label]) => (
            <li key={k}>
              <span style={{ color: steps[k] ? "var(--color-success)" : "var(--color-base-300)", flex: "none" }}>{steps[k] ? <IconCheck width={22} height={22} /> : <IconClock width={22} height={22} />}</span>
              <span style={{ fontWeight: steps[k] ? 800 : 600 }}>{label}</span>
            </li>
          ))}
        </ul>
      )}
      {passed && <div className="notice" data-tone="ok"><IconCheck /><span>Everything worked. Whether your <em>intercom</em> accepts that tone is the last check; see the README checklist.</span></div>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary flex-1" onClick={onNext}>{passed ? "Next: your phone" : "Skip for now"}</button>
      </div>
    </div>
  );
}

function StepPhones({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <NotificationsCard />
      <section className="panel" style={{ padding: "0.75rem 1rem 1rem", display: "grid", gap: "0.75rem" }}>
        <h2 className="t-title" style={{ fontSize: "1.0625rem" }}>Invite a roommate</h2>
        <p className="t-muted" style={{ fontSize: "0.875rem" }}>Send them the app link and this code. It works once and expires in 24 hours. You can make more in Settings.</p>
        {code ? <div className="code-block t-num">{code}</div> : (
          <button className="btn btn-outline" onClick={async () => { try { setCode((await api<{ code: string }>("/api/admin/invites", { body: { hours: 24 } })).code); } catch (e) { setErr((e as Error).message); } }}>Make an invite code</button>
        )}
        {err && <p role="alert" style={{ color: "var(--color-error)" }}>{err}</p>}
      </section>
      <button className="btn btn-primary btn-lg" onClick={onDone}>Open Knock</button>
    </div>
  );
}
