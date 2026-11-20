import { after } from "next/server";
import { verifyTelnyxSignature, telephony } from "@/lib/telnyx";
import { handleHangup, registerCall, runLifecycle } from "@/lib/calls";
import { handleTestEvent } from "@/lib/testcall";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/config";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function decodeState(s?: string | null) {
  if (!s) return "";
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifyTelnyxSignature({
    rawBody: raw,
    signature: req.headers.get("telnyx-signature-ed25519"),
    timestamp: req.headers.get("telnyx-timestamp"),
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const type: string = evt?.data?.event_type ?? "";
  const p = evt?.data?.payload ?? {};
  const ccid: string | undefined = p.call_control_id;
  if (!ccid) return Response.json({ ok: true });

  const state = decodeState(p.client_state);
  try {
    if (state.startsWith("test:")) {
      const work = await handleTestEvent(state.slice(5), type, ccid);
      if (work) after(work);
      return Response.json({ ok: true });
    }

    switch (type) {
      case "call.initiated": {
        if (p.direction !== "incoming") break;
        const { call, created } = await registerCall(ccid);
        if (created) {
          await telephony().answer(ccid);
          after(() => runLifecycle(call.id));
        }
        break;
      }
      case "call.answered": {
        if (p.direction === "incoming" || !p.direction) {
          const q = await db();
          const known = await q("SELECT status FROM calls WHERE call_control_id = $1", [ccid]);
          // The greeting is optional (off by default): on Telnyx Paid accounts, speech gets an automated-call
          // announcement in front of it, so silence is the better default for a building intercom.
          if (known[0] && (await getSettings()).greeting) await telephony().speak(ccid, "One moment please.");
        }
        break;
      }
      case "call.hangup":
        await handleHangup(ccid);
        break;
    }
  } catch (e) {
    console.error("telnyx webhook error", type, e);
    return new Response("error", { status: 500 }); // Telnyx will retry
  }
  return Response.json({ ok: true });
}
