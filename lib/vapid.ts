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
  return null;
}
