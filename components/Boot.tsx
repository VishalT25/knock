"use client";
import { useEffect } from "react";

/** Elements that behave like liquid glass under a finger. */
const LIVE = ".key, .btn-key, .seg button, .icon-btn, .btn, .disclosure-head"; // the dock runs its own slider gesture

/**
 * Registers the service worker and wires "live glass" press feedback:
 * the pressed control gets data-pressed plus --px/--py (where the finger is), so CSS can lift the
 * glass and chase a highlight under the touch point, like the iOS dock.
 */
export function Boot() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    let active: HTMLElement | null = null;
    const place = (el: HTMLElement, e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    const release = () => {
      if (active) delete active.dataset.pressed;
      active = null;
    };
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(LIVE);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      release();
      active = el;
      place(el, e);
      el.dataset.pressed = "1";
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      const r = active.getBoundingClientRect();
      const inside = e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
      if (!inside) return release();
      place(active, e);
    };
    // No native drag-and-drop ghosts of links/images, no long-press callouts on the app chrome.
    const noDrag = (e: Event) => { if ((e.target as Element | null)?.closest("a, img, button")) e.preventDefault(); };
    document.addEventListener("dragstart", noDrag);
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("dragstart", noDrag);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  return null;
}
