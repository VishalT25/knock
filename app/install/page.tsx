"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IconCheck, IconCopy, IconDoor, IconDotsV, IconDownload, IconPlusSquare, IconShare } from "@/components/Icons";
import { promptInstall, useInstall } from "@/lib/client/install";
import { haptic } from "@/lib/client/api";

const bar = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Chev = ({ d }: { d: string }) => (<svg {...bar}><path d={d} /></svg>);
const Book = () => (<svg {...bar}><path d="M4 5.500C4 5 4.500 4.500 5 4.500H11v15H5c-.5 0-1-.5-1-1zM20 5.500c0-.5-.5-1-1-1h-6v15h6c.5 0 1-.5 1-1z" /></svg>);
const Tabs = () => (<svg {...bar}><rect x="4" y="8" width="12" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" /></svg>);

/** A target the step is about: ringed in orange so the eye lands on it. */
const Tgt = ({ children }: { children: ReactNode }) => <span className="tgt">{children}</span>;

function Step({ n, title, hint, children }: { n: number; title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <li className="install-step">
      <span className="step-n t-num" aria-hidden>{n}</span>
      <div className="step-body">
        <strong>{title}</strong>
        {hint && <p className="t-muted">{hint}</p>}
        {children && <div className="mock" aria-hidden>{children}</div>}
      </div>
    </li>
  );
}

const Tile = () => (<span className="mock-tile"><span className="logo-mark"><IconDoor /></span><span>Knock</span></span>);

function IPhoneSteps() {
  return (
    <ol className="install-steps">
      <Step n={1} title={<>Tap <b>Share</b> in Safari</>} hint="The square with an arrow, in the bar at the bottom. If you only see •••, tap it first.">
        <div className="mock-row between">
          <span className="dim"><Chev d="M15 5l-7 7 7 7" /></span><span className="dim"><Chev d="M9 5l7 7-7 7" /></span>
          <Tgt><IconShare /></Tgt>
          <span className="dim"><Book /></span><span className="dim"><Tabs /></span>
        </div>
      </Step>
      <Step n={2} title={<>Choose <b>Add to Home Screen</b></>} hint="Scroll down the sheet if you don't see it right away.">
        <div className="mock-list">
          <div className="dim"><span>Copy</span></div>
          <div className="dim"><span>Add to Bookmarks</span></div>
          <div><Tgt><span className="mock-item"><span>Add to Home Screen</span><IconPlusSquare /></span></Tgt></div>
        </div>
      </Step>
      <Step n={3} title={<>Tap <b>Add</b></>} hint="Leave “Open as Web App” on if you see it.">
        <div className="mock-dialog">
          <div className="mock-row between"><span className="dim">Cancel</span><b>Add to Home Screen</b><Tgt><b className="mock-pill">Add</b></Tgt></div>
          <div className="mock-field"><span className="logo-mark sm"><IconDoor /></span><span>Knock</span></div>
        </div>
      </Step>
      <Step n={4} title="Open Knock from your Home Screen" hint="Not from Safari. That copy is the one that can buzz you.">
        <Tile />
      </Step>
    </ol>
  );
}

function AndroidSteps({ host }: { host: string }) {
  return (
    <ol className="install-steps">
      <Step n={1} title={<>Tap the <b>menu</b> in Chrome</>} hint="The three dots, top right. On Samsung Internet it's the ≡ menu.">
        <div className="mock-row between"><span className="mock-url dim">{host}</span><Tgt><IconDotsV /></Tgt></div>
      </Step>
      <Step n={2} title={<>Choose <b>Install app</b></>} hint="Some phones call it “Add to Home screen”.">
        <div className="mock-list">
          <div className="dim"><span>New tab</span></div>
          <div><Tgt><span className="mock-item"><span>Install app</span><IconDownload /></span></Tgt></div>
          <div className="dim"><span>Share…</span></div>
        </div>
      </Step>
      <Step n={3} title={<>Tap <b>Install</b></>}>
        <div className="mock-dialog">
          <b>Install Knock?</b>
          <div className="mock-row end"><span className="dim">Cancel</span><Tgt><b className="mock-pill">Install</b></Tgt></div>
        </div>
      </Step>
      <Step n={4} title="Open Knock from your home screen" hint="It sits with your other apps.">
        <Tile />
      </Step>
    </ol>
  );
}

export default function InstallPage() {
  const inst = useInstall();
  const [pick, setPick] = useState<"ios" | "android" | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [asked, setAsked] = useState<"idle" | "dismissed">("idle");

  useEffect(() => { setCode(new URLSearchParams(location.search).get("code") ?? ""); }, []);

  const copy = async (what: "code" | "link") => {
    try { await navigator.clipboard.writeText(what === "code" ? code : location.href); setCopied(what); haptic(15); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  if (!inst.ready) return <main className="screen" style={{ minHeight: "100dvh" }} />;

  const platform: "ios" | "android" = pick ?? (inst.platform === "android" ? "android" : "ios");
  const why = platform === "ios"
    ? "On iPhone, notifications only work from the Home Screen copy, so do this first."
    : "One tap opens the door, and it can buzz you even when the app is closed.";

  if (inst.standalone) {
    return (
      <main className="screen" style={{ minHeight: "100dvh", justifyContent: "center" }}>
        <div className="notice" data-tone="ok" role="status"><IconCheck /><div><strong className="t-title" style={{ fontSize: "1.0625rem" }}>Knock is installed on this phone.</strong><p>You're using the Home Screen copy.</p></div></div>
        <Link className="btn btn-primary btn-lg" href="/">Back to Knock</Link>
      </main>
    );
  }

  return (
    <main className="screen" style={{ minHeight: "100dvh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span className="logo-mark"><IconDoor /></span>
        <h1 className="t-title" style={{ fontSize: "1.625rem", textWrap: "balance" }}>Add Knock to your Home Screen</h1>
      </div>
      <p className="t-muted">{why}</p>

      {inst.platform === "other" && <div className="notice" role="status"><div>You're on a computer. Open this page on your phone to install it there.</div></div>}

      {inst.inApp && (
        <div className="notice" data-tone="warn" role="status">
          <IconCopy />
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <strong>This in-app browser can't install Knock.</strong>
            <p>Copy the link and open it in {inst.platform === "android" ? "Chrome" : "Safari"}.</p>
            <button className="btn btn-sm btn-primary" onClick={() => copy("link")}>{copied === "link" ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      )}

      {code && (
        <div className="panel code-chip">
          <div><span className="t-label">Your invite code</span><div className="t-num code">{code}</div></div>
          <button className="btn btn-sm btn-ghost" onClick={() => copy("code")}>{copied === "code" ? "Copied" : "Copy"}</button>
        </div>
      )}

      <div className="seg" role="group" aria-label="Phone type">
        <button aria-pressed={platform === "ios"} onClick={() => setPick("ios")}>iPhone</button>
        <button aria-pressed={platform === "android"} onClick={() => setPick("android")}>Android</button>
      </div>

      {platform === "android" && inst.canPrompt && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <button className="btn btn-primary btn-lg" onClick={async () => { const r = await promptInstall(); if (r === "dismissed") setAsked("dismissed"); }}>Install Knock</button>
          {asked === "dismissed" && <p className="t-muted" role="status">No problem. The steps below do the same thing.</p>}
        </div>
      )}

      <section className="panel" style={{ padding: "0.25rem 1rem" }} aria-label="Steps">
        {platform === "ios" ? <IPhoneSteps /> : <AndroidSteps host={typeof location !== "undefined" ? location.host : "knock"} />}
      </section>

      {platform === "ios" && (
        <p className="t-muted fine">
          The Home Screen copy has its own sign-in. {code ? "Enter the invite code above there." : "If you already joined in Safari, join again from the Home Screen copy with a fresh invite code."}
        </p>
      )}
      <Link className="btn btn-outline" href={code ? `/join?code=${encodeURIComponent(code)}` : "/"}>{code ? "Back to joining" : "Back to Knock"}</Link>
    </main>
  );
}
