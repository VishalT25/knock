"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/client/useAppState";
import { api } from "@/lib/client/api";
import { IconDoor, IconGear, IconList, IconPeople } from "./Icons";
import { ThemeButton } from "./Theme";

const TABS = [
  { href: "/", label: "Open", Icon: IconDoor },
  { href: "/log", label: "Log", Icon: IconList },
  { href: "/household", label: "Household", Icon: IconPeople },
  { href: "/settings", label: "Settings", Icon: IconGear },
];

export function useCountdown(untilIso: string | null | undefined, skew: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilIso) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [untilIso]);
  if (!untilIso) return 0;
  return Math.max(0, Math.ceil((new Date(untilIso).getTime() - (now + skew)) / 1000));
}

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function AutoOpenBanner({ sticky = true }: { sticky?: boolean }) {
  const { state, skew, refresh } = useAppState();
  const left = useCountdown(state?.autoOpen?.until, skew);
  const [busy, setBusy] = useState(false);
  if (!state?.autoOpen || left <= 0) return null;
  const mine = state.autoOpen.byName === state.me.name;
  return (
    <div className={`banner ${sticky ? "sticky" : ""}`} role="status">
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Auto-open on</strong>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Calls open by themselves{mine ? "" : ` · set by ${state.autoOpen.byName}`}</div>
      </div>
      <span className="count t-num" aria-label={`${Math.ceil(left / 60)} minutes left`}>{fmtClock(left)}</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await api("/api/auto-open", { method: "DELETE" }); await refresh(); } finally { setBusy(false); }
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, online } = useAppState();
  const ringing = state?.call?.status === "ringing";
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.href === path));
  return (
    <div className="frame">
      <div className="glow" data-glow={ringing ? "ring" : state?.call?.status === "opened" ? "opened" : "idle"} aria-hidden />
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <span className="logo-mark"><IconDoor /></span>
          <div style={{ minWidth: 0 }}>
            <div className="wordmark">Knock</div>
            <div className="t-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{state?.household.name ?? " "}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="chip" role="status">
            <span className="dot" data-on={online ? "true" : "warn"} />
            {online ? "Live" : "Reconnecting"}
          </span>
          <ThemeButton />
        </div>
      </header>
      <main className="screen" style={{ paddingBottom: "1rem" }}>
        {!online && state && (
          <div className="notice" data-tone="warn" role="alert">
            <span>Connection lost. You may miss a buzz. Trying again…</span>
          </div>
        )}
        {path !== "/" && <AutoOpenBanner />}
        {state ? <div className="route" key={path}>{children}</div> : <Loading />}
      </main>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner" style={{ ["--i" as string]: activeIdx }}>
          <span className="tab-ind" aria-hidden />
        {TABS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
            <Icon />
            {label}
            {href === "/" && ringing && path !== "/" && <span className="tab-dot" aria-label="Someone is at the door" />}
          </Link>
        ))}
        </div>
      </nav>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: "0.75rem", paddingTop: "1rem" }}>
      <div className="skeleton-line" style={{ width: "60%" }} />
      <div className="skeleton-line" style={{ height: "14rem", borderRadius: "1.75rem" }} />
      <div className="skeleton-line" style={{ width: "40%" }} />
    </div>
  );
}
