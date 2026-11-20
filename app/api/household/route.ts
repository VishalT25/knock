import { requireMe, route } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const me = await requireMe();
  const q = await db();
  const users = await q(
    `SELECT u.id, u.name, u.role, u.expecting_until,
       (SELECT count(*) FROM devices d WHERE d.user_id = u.id AND d.revoked_at IS NULL) AS devices,
       (SELECT count(*) FROM devices d WHERE d.user_id = u.id AND d.revoked_at IS NULL AND d.push_sub IS NOT NULL) AS push_devices
     FROM users u ORDER BY u.created_at`,
  );
  const now = Date.now();
  const members = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    isMe: u.id === me.id,
    expecting: !!u.expecting_until && new Date(u.expecting_until).getTime() > now,
    expectingUntil: u.expecting_until ? new Date(u.expecting_until).toISOString() : null,
    devices: Number(u.devices),
    pushDevices: Number(u.push_devices),
  }));
  let devices: unknown[] = [];
  let invites: unknown[] = [];
  if (me.role === "admin") {
    const dv = await q(
      `SELECT d.id, d.label, d.created_at, d.last_seen, d.push_sub IS NOT NULL AS push, u.name AS user_name, u.id AS user_id
       FROM devices d JOIN users u ON u.id = d.user_id WHERE d.revoked_at IS NULL ORDER BY d.created_at`,
    );
    devices = dv.map((d) => ({ id: d.id, label: d.label, createdAt: new Date(d.created_at).toISOString(), lastSeen: new Date(d.last_seen).toISOString(), push: d.push, userName: d.user_name, userId: d.user_id, isThisDevice: d.id === me.deviceId }));
    const iv = await q("SELECT code_hash, hint, expires_at, used_at FROM invites WHERE used_at IS NULL AND expires_at > now() ORDER BY expires_at");
    invites = iv.map((i) => ({ id: i.code_hash, hint: i.hint, expiresAt: new Date(i.expires_at).toISOString() }));
  }
  return Response.json({ members, devices, invites });
});
