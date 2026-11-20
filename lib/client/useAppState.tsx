"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppState } from "@/lib/state";
import { api, ApiError } from "./api";

type Ctx = { state: AppState | null; online: boolean; refresh: () => Promise<void>; setState: (s: AppState) => void; skew: number };
const StateCtx = createContext<Ctx>({ state: null, online: true, refresh: async () => {}, setState: () => {}, skew: 0 });
export const useAppState = () => useContext(StateCtx);

/** Live state: SSE first, polling fallback, refetch on focus and on push messages. */
export function StateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setStateRaw] = useState<AppState | null>(null);
  const [online, setOnline] = useState(true);
  const [skew, setSkew] = useState(0);
  const sseFails = useRef(0);

  const setState = useCallback((s: AppState) => {
    setStateRaw(s);
    setSkew(new Date(s.now).getTime() - Date.now());
    setOnline(true);
  }, []);

  const bounce = useCallback(async () => {
    try {
      const s = await api<{ needsSetup: boolean }>("/api/setup");
      router.replace(s.needsSetup ? "/setup" : "/join");
    } catch {
      router.replace("/join");
    }
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      setState(await api<AppState>("/api/state"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await bounce();
      else setOnline(false);
    }
  }, [bounce, setState]);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const startPoll = () => {
      if (poll) return;
      poll = setInterval(refresh, 2000);
    };
    const stopPoll = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    const connect = () => {
      if (closed || typeof EventSource === "undefined") return startPoll();
      es = new EventSource("/api/stream");
      es.onmessage = (ev) => {
        sseFails.current = 0;
        stopPoll();
        try { setState(JSON.parse(ev.data)); } catch {}
      };
      es.onerror = () => {
        es?.close();
        es = null;
        sseFails.current += 1;
        if (sseFails.current >= 3) startPoll(); // stream keeps failing: poll instead
        setTimeout(connect, Math.min(1000 * sseFails.current, 5000));
        refresh();
      };
    };

    refresh().then(connect);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    const onNet = () => refresh();
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "knock-push") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onNet);
    window.addEventListener("focus", onNet);
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      closed = true;
      es?.close();
      stopPoll();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onNet);
      window.removeEventListener("focus", onNet);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, [refresh, setState]);

  return <StateCtx.Provider value={{ state, online, refresh, setState, skew }}>{children}</StateCtx.Provider>;
}
