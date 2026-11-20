import { requireMe, route } from "@/lib/auth";
import { listLog } from "@/lib/calls";

export const dynamic = "force-dynamic";
export const GET = route(async () => {
  await requireMe();
  const rows = await listLog(100);
  return Response.json({
    entries: rows.map((c) => ({
      id: c.id,
      at: c.startedAt.toISOString(),
      status: c.status,
      method: c.method,
      openedByName: c.openedByName,
      autoByName: c.autoByName,
      escalated: !!c.escalatedAt,
      secondsToOpen: c.openedAt ? Math.round((c.openedAt.getTime() - c.startedAt.getTime()) / 1000) : null,
    })),
  });
});
