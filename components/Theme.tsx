"use client";
import { useCallback, useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

export type ThemePref = "system" | "light" | "dark";
const KEY = "knock-theme";

function read(): ThemePref {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
function apply(p: ThemePref) {
  const el = document.documentElement;
  if (p === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", `knock-${p}`);
  try { if (p === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch {}
  const dark = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#1b1511" : "#f7efe8"));
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setPref(read());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(document.documentElement.getAttribute("data-theme") === "knock-dark" || (!document.documentElement.getAttribute("data-theme") && mq.matches));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const set = useCallback((p: ThemePref) => {
    apply(p);
    setPref(p);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setDark(p === "dark" || (p === "system" && mq.matches));
  }, []);
  return { pref, dark, set };
}

/** One-tap light/dark button for the top bar. */
export function ThemeButton() {
  const { dark, set } = useTheme();
  return (
    <button className="icon-btn glass" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => set(dark ? "light" : "dark")}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

/** System / Light / Dark chooser for Settings. */
export function ThemeChooser() {
  const { pref, set } = useTheme();
  return (
    <div className="seg" role="group" aria-label="Appearance">
      {(["system", "light", "dark"] as ThemePref[]).map((p) => (
        <button key={p} aria-pressed={pref === p} onClick={() => set(p)}>{p === "system" ? "Auto" : p === "light" ? "Light" : "Dark"}</button>
      ))}
    </div>
  );
}
