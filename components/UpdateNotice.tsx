"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { IconDownload } from "./Icons";

type Check = { current: string; latest: string | null; updateAvailable: boolean; repo: string | null };
const DOCS = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://knockbuzzer.app/docs";

/** Admins only: which version this is, and whether a newer Knock exists. */
export function UpdateNotice() {
  const [c, setC] = useState<Check | null>(null);
  useEffect(() => { api<Check>("/api/admin/update-check").then(setC).catch(() => {}); }, []);
  if (!c) return null;
  if (!c.updateAvailable) return <p className="t-muted" style={{ fontSize: "0.8125rem" }}>Knock {c.current}{c.latest ? ", up to date." : "."}</p>;
  return (
    <div className="notice" data-tone="warn" role="status">
      <IconDownload />
      <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
        <strong className="t-title" style={{ fontSize: "1rem" }}>Knock {c.latest} is available</strong>
        <p>You're on {c.current}. Updating takes one merge: look for an &ldquo;Update Knock&rdquo; pull request in your GitHub repository, and merge it. Vercel then redeploys.</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {c.repo && <a className="btn btn-sm btn-primary" href={`${c.repo}/pulls`} target="_blank" rel="noopener noreferrer">Open my repository</a>}
          <a className="btn btn-sm btn-ghost" href={`${DOCS}/updating`} target="_blank" rel="noopener noreferrer">How updating works</a>
        </div>
      </div>
    </div>
  );
}
