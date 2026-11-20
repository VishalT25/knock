"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useAppState } from "@/lib/client/useAppState";
import { ExpectingControl, AutoOpenControl } from "@/components/ExpectingAutoOpen";

type Member = { id: string; name: string; role: string; isMe: boolean; expecting: boolean; expectingUntil: string | null; devices: number; pushDevices: number };

export default function HouseholdPage() {
  const { state } = useAppState();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [err, setErr] = useState("");

  const load = () => api<{ members: Member[] }>("/api/household").then((r) => setMembers(r.members)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [state?.me.expectingUntil, state?.autoOpen?.until]);

  return (
    <>
      <h1 className="t-title" style={{ fontSize: "1.75rem" }}>Household</h1>
      {err && <div className="notice" data-tone="error" role="alert">{err}</div>}

      <section aria-label="Members">
        <ul className="panel">
          {(members ?? []).map((m) => (
            <li key={m.id} className="row">
              <span className="avatar-mark" aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontStretch: "108%" }}>{m.name}{m.isMe && <span className="t-muted"> (you)</span>}</p>
                <p className="t-muted" style={{ fontSize: "0.8125rem" }}>
                  {m.role === "admin" ? "Admin · " : ""}{m.pushDevices > 0 ? "Notifications on" : "No notifications"}
                </p>
              </div>
              {m.expecting && m.expectingUntil && <span className="badge badge-warning" style={{ fontWeight: 800 }}>Expecting</span>}
            </li>
          ))}
          {members === null && <li className="row"><span className="skeleton-line" style={{ width: "50%" }} /></li>}
        </ul>
      </section>

      <h2 className="h-section">When someone buzzes</h2>
      <ExpectingControl />
      <AutoOpenControl />
    </>
  );
}
