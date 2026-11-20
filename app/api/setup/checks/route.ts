import { requireAdmin, route } from "@/lib/auth";
import { checkApiKey, isMock } from "@/lib/telnyx";
import { pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = route(async (req: Request) => {
  await requireAdmin();
  const origin = process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  const key = await checkApiKey();

  // Webhook reachability: POST an unsigned body to our own public URL. A 401 proves the route is
  // reachable from outside AND rejects unsigned traffic, which is exactly what we want.
  let webhook: { ok: boolean; detail: string };
  try {
    const res = await fetch(`${origin}/api/telnyx`, { method: "POST", body: "{}", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000) });
    webhook =
      res.status === 401
        ? { ok: true, detail: `${origin}/api/telnyx is reachable and rejects unsigned requests.` }
        : { ok: false, detail: `${origin}/api/telnyx answered HTTP ${res.status}; expected 401 for an unsigned request.` };
  } catch (e) {
    webhook = { ok: false, detail: `Could not reach ${origin}/api/telnyx: ${(e as Error).message}` };
  }

  const checks = [
    { id: "telnyx_key", label: "Telnyx API key", ...key },
    { id: "public_key", label: "Webhook signing key", ok: isMock() || !!process.env.TELNYX_PUBLIC_KEY, detail: process.env.TELNYX_PUBLIC_KEY || isMock() ? "TELNYX_PUBLIC_KEY is set." : "TELNYX_PUBLIC_KEY is missing, so every webhook would be rejected." },
    { id: "connection", label: "Call Control application", ok: isMock() || (!!process.env.TELNYX_CONNECTION_ID && !!process.env.TELNYX_NUMBER), detail: process.env.TELNYX_CONNECTION_ID && process.env.TELNYX_NUMBER ? "Connection ID and number are set." : "TELNYX_CONNECTION_ID and TELNYX_NUMBER are needed for test and fallback calls." },
    { id: "webhook", label: "Webhook reachable", ...webhook },
    { id: "push", label: "Web push keys", ok: pushConfigured(), detail: pushConfigured() ? "VAPID keys are set." : "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are missing; notifications cannot be sent." },
  ];
  return Response.json({ origin, checks });
});
