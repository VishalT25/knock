"use client";
import { useState } from "react";
import { useAppState } from "@/lib/client/useAppState";
import { formatPhone } from "@/lib/phone";
import { IconCopy } from "./Icons";

/** The number the building's intercom should call. Read-only: it is fixed by Telnyx and the building. */
export function BuzzerNumberCard() {
  const { state } = useAppState();
  const [copied, setCopied] = useState(false);
  if (!state) return null;
  const number = state.household.buzzerNumber;
  const admin = state.me.role === "admin";

  return (
    <section className="panel" style={{ padding: "0.875rem 1rem 1rem", display: "grid", gap: "0.5rem" }} aria-labelledby="bz-h">
      <h2 id="bz-h" className="t-label">Buzzer number</h2>
      {number ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <p className="t-num t-title" style={{ fontSize: "1.5rem", flex: 1 }}>{formatPhone(number)}</p>
            <button
              className="btn btn-sm btn-outline"
              onClick={async () => {
                try { await navigator.clipboard.writeText(number); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
              }}
            >
              <IconCopy width={18} height={18} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="t-muted" style={{ fontSize: "0.875rem" }}>Your building's intercom should call this number.</p>
        </>
      ) : (
        <p className="t-muted">{admin ? "Not set. Add TELNYX_NUMBER in your server settings (Vercel), then redeploy." : "The admin hasn't set the buzzer number yet."}</p>
      )}
    </section>
  );
}
