import crypto from "node:crypto";

/** Clean and validate web-push (VAPID) keys so a bad paste gives a clear message instead of a browser error. */
export function cleanKey(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
}

function bytes(b64url: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(b64url)) return null;
  try {
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    return Uint8Array.from(Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64"));
  } catch {
    return null;
  }
}

/** Returns a human-readable problem, or null when both keys look right. */
export function vapidProblem(pub: string | undefined, priv: string | undefined): string | null {
  const p = cleanKey(pub), s = cleanKey(priv);
  if (!p || !s) return "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are both needed.";
  const pb = bytes(p), sb = bytes(s);
  if (!pb) return "VAPID_PUBLIC_KEY has characters a key can't have. Paste it again without quotes.";
  if (pb.length === 32) return "VAPID_PUBLIC_KEY looks like the private key (too short). The two are swapped or duplicated.";
  if (pb.length !== 65 || pb[0] !== 4) return `VAPID_PUBLIC_KEY is the wrong length (${p.length} characters; it should be 87). It was probably cut off when pasting.`;
  if (!sb || sb.length !== 32) return `VAPID_PRIVATE_KEY is the wrong length (${s.length} characters; it should be 43).`;
  if (pairMismatch(p, s)) return "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are both valid keys but they are not a pair. Copy both from the same generated set (.env.vercel).";
  return null;
}

/**
 * VAPID_SUBJECT must be "mailto:you@example.com" or an https URL, or the push library refuses to start.
 * People paste a bare email, add quotes, or leave it blank, so repair those instead of failing.
 */
export function normalizeSubject(v: string | undefined): string {
  const t = (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!t) return "mailto:admin@example.com";
  if (/^(mailto:|https:\/\/)/i.test(t)) return t;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return `https://${t}`;
  return "mailto:admin@example.com";
}

/** Do the public and private key belong together? A mismatched pair is rejected by Apple/Google with a 403. */
export function pairMismatch(pub: string, priv: string): boolean {
  const pb = bytes(cleanKey(pub)), sb = bytes(cleanKey(priv));
  if (!pb || !sb || sb.length !== 32) return false;
  try {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(sb));
    return !ecdh.getPublicKey().equals(Buffer.from(pb));
  } catch {
    return true;
  }
}
