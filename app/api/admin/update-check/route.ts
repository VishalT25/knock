import { requireAdmin, route } from "@/lib/auth";
import { isNewer, VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const UPSTREAM_PACKAGE = "https://raw.githubusercontent.com/VishalT25/knock/main/package.json";

/** Is a newer Knock out? Asks the public project (no data about you is sent) and caches the answer for hours. */
export const GET = route(async () => {
  await requireAdmin();
  let latest: string | null = null;
  try {
    const res = await fetch(UPSTREAM_PACKAGE, { next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(5000) });
    if (res.ok) latest = String((await res.json()).version ?? "") || null;
  } catch {}
  // Vercel exposes the repository this copy deploys from.
  const owner = process.env.VERCEL_GIT_REPO_OWNER, slug = process.env.VERCEL_GIT_REPO_SLUG;
  return Response.json({
    current: VERSION,
    latest,
    updateAvailable: latest ? isNewer(latest, VERSION) : false,
    repo: owner && slug ? `https://github.com/${owner}/${slug}` : null,
  });
});
