/** "+14155550123" -> "+1 415 555 0123". Other countries are grouped loosely; never throws. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `+1 ${m[1]} ${m[2]} ${m[3]}`;
  const d = /^\+(\d{1,3})(\d+)$/.exec(e164);
  return d ? `+${d[1]} ${d[2].replace(/(\d{3,4})(?=\d)/g, "$1 ")}` : e164;
}
