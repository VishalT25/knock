/** Which deployment this code came from (Vercel sets the commit SHA). "dev" when running locally. */
export const SERVER_BUILD = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

/** True when an open page was built from a different deployment than the server it is talking to now. */
export function isStaleBuild(client: string | undefined, server: string | undefined): boolean {
  if (!client || !server || client === "dev" || server === "dev") return false;
  return client !== server;
}
