import { NextResponse, type NextRequest } from "next/server";

/**
 * Vercel gives every deployment a permanent address of its own (the long one with random letters) next to your
 * project's real address. The permanent one never updates, and sessions don't carry between the two, so a person who
 * sets up Knock there would be stranded on an old version. Send page visits there to the real address instead.
 */
export function proxy(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.next();
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL; // the project's real address (or custom domain), no protocol
  const host = req.headers.get("host");
  // Only this deployment's own permanent address is redirected. The real address, custom domains and branch aliases are left alone.
  if (!prod || !host || host === prod || host !== process.env.VERCEL_URL) return NextResponse.next();
  if (req.method !== "GET" || !(req.headers.get("accept") ?? "").includes("text/html")) return NextResponse.next();
  return NextResponse.redirect(`https://${prod}${req.nextUrl.pathname}${req.nextUrl.search}`, 307);
}

// Pages only: never the API (webhooks must not be redirected), build files, or the service worker.
export const config = { matcher: ["/((?!api|_next|icons|sw\\.js|manifest\\.webmanifest).*)"] };
