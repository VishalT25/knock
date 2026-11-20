"use client";
import { useState } from "react";
import { useAppState } from "@/lib/client/useAppState";
import { formatPhone } from "@/lib/phone";
import { IconCopy } from "./Icons";

/** The number the building's intercom should call, on the same glass readout as the Open screen. Read-only. */
export function BuzzerNumberCard() {
  const { state } = useAppState();
  const [copied, setCopied] = useState(false);
  if (!state) return null;
  const number = state.household.buzzerNumber;
  const admin = state.me.role === "admin";

  return (
    <section className="lcd lcd-number" aria-labelledby="bz-h">
      <div className="lcd-top"><span id="bz-h">Buzzer number</span></div>
      {number ? (
        <div className="lcd-main t-num" aria-label={`Buzzer number ${number.split("").join(" ")}`}>{formatPhone(number)}</div>
      ) : (
        <div className="lcd-main">Not set</div>
      )}
      <div className="lcd-row">
        <p className="lcd-sub">
          {number ? "Your building's intercom should call this number." : admin ? "Add TELNYX_NUMBER in Vercel, then redeploy." : "The admin hasn't set it yet."}
        </p>
        {number && (
          <button
            className="btn btn-sm btn-outline"
            onClick={async () => {
              try { await navigator.clipboard.writeText(number); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
            }}
          >
            <IconCopy width={18} height={18} /> {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </section>
  );
}
