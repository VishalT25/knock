import { ImageResponse } from "next/og";

/** iOS launch image: warm gradient, orange glow, the Knock tile. Size is "WIDTHxHEIGHT" in device pixels. */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const [w0, h0] = size.split("x").map((n) => Number.parseInt(n, 10));
  const w = Math.min(1500, Math.max(320, w0 || 1170));
  const h = Math.min(3000, Math.max(480, h0 || 2532));
  const tile = Math.round(w * 0.22);
  const glyph = tile * 0.58;
  return new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 46%, #fbd2b6 0%, #fbe6d6 32%, #f7efe8 68%)" }}>
        <div style={{ width: tile, height: tile, borderRadius: tile * 0.225, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #f58a57, #f0642a)", boxShadow: `0 ${tile * 0.1}px ${tile * 0.28}px rgba(240,100,42,0.35)` }}>
          <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none" stroke="#1c1a17" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 56V10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v46" />
            <path d="M4 56h56" />
            <path d="M14 12h16v44H14z" fill="#1c1a17" fillOpacity="0.15" />
            <path d="M40 32h16M50 24l8 8-8 8" />
          </svg>
        </div>
      </div>
    ),
    { width: w, height: h, headers: { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" } },
  );
}
