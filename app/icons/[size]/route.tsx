import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

/** Generated app icon: exit-sign green tile with the door-and-arrow glyph. No binary assets to maintain. */
export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = Math.min(1024, Math.max(48, Number.parseInt(size, 10) || 192));
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const glyph = px * (maskable ? 0.5 : 0.62);
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, background: "#f0642a", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: maskable ? 0 : px * 0.22 }}>
        <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none" stroke="#1c1a17" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 56V10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v46" />
          <path d="M4 56h56" />
          <path d="M14 12h16v44H14z" fill="#1c1a17" fillOpacity="0.15" />
          <path d="M40 32h16M50 24l8 8-8 8" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
