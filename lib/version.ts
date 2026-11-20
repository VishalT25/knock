import pkg from "../package.json";

export const VERSION: string = pkg.version;

/** True when `latest` is a newer x.y.z than `current`. Anything unparseable counts as "not newer". */
export function isNewer(latest: string, current: string): boolean {
  const n = (v: string) => v.trim().replace(/^v/, "").split(".").map((x) => Number.parseInt(x, 10));
  const a = n(latest), b = n(current);
  if (a.length < 3 || b.length < 3 || [...a, ...b].some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
