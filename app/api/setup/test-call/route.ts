import { after } from "next/server";
import { HttpError, rateLimit, requireAdmin, route } from "@/lib/auth";
import { getTestRun, runMockTest, startTestRun } from "@/lib/testcall";
import { isMock } from "@/lib/telnyx";
import { isE164, readJson } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const me = await requireAdmin();
  await rateLimit(`testcall:${me.id}`, 5, 300);
  const body = await readJson(req);
  const to = String(body.to ?? "").replace(/[\s()-]/g, "");
  if (!isE164(to)) throw new HttpError(400, "Enter the number in international format, like +14155550123.");
  const id = await startTestRun(to);
  if (isMock()) after(() => runMockTest(id));
  return Response.json({ id });
});

export const GET = route(async (req: Request) => {
  await requireAdmin();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const run = await getTestRun(id);
  if (!run) throw new HttpError(404, "No such test");
  return Response.json({ steps: run.steps, error: run.error });
});
