"use client";
import { useEffect, useState } from "react";

/** Two-tap confirm: first tap arms it for 4 seconds, second tap runs it. No browser dialogs. */
export function ConfirmButton({ label, confirmLabel = "Tap again to confirm", onConfirm, className = "btn btn-sm btn-outline btn-error" }: { label: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      aria-live="polite"
      onClick={async () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        await onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
