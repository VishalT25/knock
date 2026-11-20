"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/client/useAppState";
import { api, haptic } from "@/lib/client/api";
import { IconDoor, IconGear, IconList, IconPeople } from "./Icons";
import { ThemeButton } from "./Theme";
import { isStaleBuild } from "@/lib/build";

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
  return (
    <div className="frame">
      <div className="glow" data-glow={ringing ? "ring" : state?.call?.status === "opened" ? "opened" : "idle"} aria-hidden />
      <header className="topbar-wrap">
      <div className="topbar">
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
      </div>
      </header>
      <main className="screen" style={{ paddingBottom: "1rem" }}>
        {!online && state && (
          <div className="notice" data-tone="warn" role="alert">
            <span>Connection lost. You may miss a buzz. Trying again…</span>
          </div>
        )}
        {state && isStaleBuild(process.env.NEXT_PUBLIC_BUILD_ID, state.build) && (
          <div className="notice" data-tone="warn" role="status">
            <div style={{ flex: 1 }}><strong>A new version of Knock is ready.</strong> Refresh to get it.</div>
            <button className="btn btn-sm btn-primary" onClick={() => location.reload()}>Refresh</button>
          </div>
        )}
        {path !== "/" && <AutoOpenBanner />}
        {state ? <div className="route" key={path}>{children}</div> : <Loading />}
      </main>
      <Dock path={path} ringing={ringing && path !== "/"} />
    </div>
  );
}


/**
 * Floating glass dock. Tap a tab, or press anywhere on the dock and slide: the glass capsule follows your finger
 * (it can sit between tabs), and the tab under it is opened when you let go.
 */
function Dock({ path, ringing }: { path: string; ringing: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.href === path));
  const [pos, setPos] = useState<number | null>(null); // fractional tab index while a finger is down
  const [landing, setLanding] = useState<number | null>(null); // where it was released, until the route catches up
  const drag = useRef<{ id: number } | null>(null);
  const lastIdx = useRef(-1);

  useEffect(() => setLanding(null), [path]);

  const posFromX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const pad = 6, gap = 4; // matches .tabbar-inner padding / gap (0.375rem / 0.25rem)
    const col = (r.width - pad * 2 - gap * 3) / 4;
    return Math.min(3, Math.max(0, (clientX - r.left - pad - col / 2) / (col + gap)));
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId };
    const p = posFromX(e.clientX);
    lastIdx.current = Math.round(p);
    setPos(p);
    haptic(8);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const p = posFromX(e.clientX);
    setPos(p);
    const idx = Math.round(p);
    if (idx !== lastIdx.current) { lastIdx.current = idx; haptic(6); }
  };
  const up = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    const idx = Math.round(posFromX(e.clientX));
    setPos(null);
    setLanding(idx);
    if (TABS[idx].href !== path) router.push(TABS[idx].href);
  };
  const cancel = () => { drag.current = null; setPos(null); };

  const shown = pos ?? landing ?? activeIdx;
  const hot = pos !== null ? Math.round(pos) : -1;
  return (
    <nav className="tabbar" aria-label="Main">
      <div
        ref={ref}
        className="tabbar-inner"
        data-dragging={pos !== null}
        style={{ ["--i" as string]: shown }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        <span className="tab-ind" aria-hidden />
        {TABS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            href={href}
            draggable={false}
            aria-current={path === href ? "page" : undefined}
            data-hot={hot === i}
            // Pointer taps and slides are handled above; only keyboard activation (detail 0) follows the link.
            onClick={(e) => { if (e.detail !== 0) e.preventDefault(); }}
          >
            <Icon />
            {label}
            {href === "/" && ringing && <span className="tab-dot" aria-label="Someone is at the door" />}
          </Link>
        ))}
      </div>
    </nav>
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
