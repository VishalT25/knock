import { db } from "./db";

export type Settings = {
  householdName: string;
  timezone: string;
  unlockDigit: string;
  escalateAfter: number;
  backupTimeout: number;
  fallbackNumber: string;
  autoOpenMax: number;
  buzzerNumber: string;
};

function envInt(name: string, def: number) {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function envDefaults() {
  return {
    unlockDigit: (process.env.UNLOCK_DIGIT ?? "9").slice(0, 8) || "9",
    escalateAfter: envInt("ESCALATE_AFTER", 8),
    backupTimeout: envInt("BACKUP_TIMEOUT", 20),
    fallbackNumber: process.env.FALLBACK_NUMBER ?? "",
    autoOpenMax: Math.min(60, envInt("AUTO_OPEN_MAX_MINUTES", 60)),
    buzzerNumber: process.env.TELNYX_NUMBER ?? "",
  };
}

export async function getHousehold() {
  const q = await db();
  const rows = await q("SELECT * FROM household WHERE id = 1");
  return rows[0] ?? null;
}

/** Saved value wins; env supplies defaults. */
export async function getSettings(): Promise<Settings> {
  const h = await getHousehold();
  const d = envDefaults();
  return {
    householdName: h?.name ?? "Household",
    timezone: h?.timezone ?? "UTC",
    unlockDigit: h?.unlock_digit ?? d.unlockDigit,
    escalateAfter: h?.escalate_after ?? d.escalateAfter,
    backupTimeout: h?.backup_timeout ?? d.backupTimeout,
    fallbackNumber: h?.fallback_number ?? d.fallbackNumber,
    autoOpenMax: Math.min(60, h?.auto_open_max ?? d.autoOpenMax),
    buzzerNumber: d.buzzerNumber, // fixed by Telnyx: comes from TELNYX_NUMBER
  };
}

export const AUTO_OPEN_CHOICES = [10, 20, 30, 60] as const;
