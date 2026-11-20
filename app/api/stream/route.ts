import { requireMe, route } from "@/lib/auth";
import { buildState } from "@/lib/state";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Server-sent events. Emits a snapshot whenever it changes; closes after ~50s so the client reconnects. */
export const GET = route(async (req: Request) => {
  const me = await requireMe();
  const enc = new TextEncoder();
  let last = "";
  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      controller.enqueue(enc.encode("retry: 1500\n\n"));
      while (!req.signal.aborted && Date.now() - started < 50_000) {
        try {
          const s = await buildState(me);
          const key = JSON.stringify({ ...s, now: undefined });
          if (key !== last) {
            last = key;
            controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
          } else {
            controller.enqueue(enc.encode(": ping\n\n"));
          }
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      try { controller.close(); } catch {}
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
});
