/**
 * Tiny Postgres access layer.
 * - Production: Neon serverless driver over DATABASE_URL.
 * - Dev/tests with no DATABASE_URL: embedded PGlite (real Postgres semantics).
 */
export type Row = Record<string, any>;
export type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS household (
  id int PRIMARY KEY DEFAULT 1,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  unlock_digit text,
  escalate_after int,
  backup_timeout int,
  fallback_number text,
  auto_open_max int,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
ALTER TABLE household ADD COLUMN IF NOT EXISTS greeting boolean;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  quiet_start text,
  quiet_end text,
  expecting_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  label text,
  push_sub jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS invites (
  code_hash text PRIMARY KEY,
  hint text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid
);
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_control_id text UNIQUE,
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  escalated_at timestamptz,
  claimed_at timestamptz,
  opened_at timestamptz,
  opened_by uuid REFERENCES users(id) ON DELETE SET NULL,
  opened_by_name text,
  method text,
  ended_at timestamptz,
  fallback_at timestamptz,
  notified jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_by_name text,
  last_error text
);
CREATE INDEX IF NOT EXISTS calls_started_idx ON calls (started_at DESC);
CREATE TABLE IF NOT EXISTS auto_open (
  id int PRIMARY KEY DEFAULT 1,
  until timestamptz,
  enabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  enabled_by_name text,
  CHECK (id = 1)
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count int NOT NULL
);
CREATE TABLE IF NOT EXISTS test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_control_id text,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
`;

type G = typeof globalThis & { __knockQuery?: Query; __knockReady?: Promise<void> };
const g = globalThis as G;

async function makeQuery(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const client = neon(url);
    return async (text, params = []) => (await client.query(text, params as any[])) as Row[];
  }
  if (process.env.NODE_ENV === "production" && !process.env.KNOCK_ALLOW_EMBEDDED_DB) {
    throw new Error("DATABASE_URL is not set");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  // Keep the dev database OUTSIDE the project folder: writes inside it make Next's file watcher recompile and reload the page.
  const { homedir } = await import("node:os");
  const path = await import("node:path");
  const fs = await import("node:fs");
  const dir = process.env.KNOCK_PGLITE_DIR === "memory" ? undefined : (process.env.KNOCK_PGLITE_DIR ?? path.join(homedir(), ".knock", "dev-db"));
  if (dir) fs.mkdirSync(path.dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return async (text, params = []) => {
    const res = await db.query<Row>(text, params as any[]);
    return res.rows;
  };
}

export async function db(): Promise<Query> {
  if (!g.__knockQuery) {
    g.__knockQuery = await makeQuery();
    const q = g.__knockQuery;
    g.__knockReady = (async () => {
      for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        await q(stmt);
      }
    })();
  }
  await g.__knockReady;
  return g.__knockQuery;
}

/** Test helper: swap in a fresh store. */
export async function resetDbForTests(): Promise<Query> {
  g.__knockQuery = undefined;
  g.__knockReady = undefined;
  process.env.KNOCK_PGLITE_DIR = "memory";
  delete process.env.DATABASE_URL;
  return db();
}
