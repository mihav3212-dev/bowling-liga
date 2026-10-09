import { neon } from "@neondatabase/serverless";

let cached;

export function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!url) return null;
  if (!cached) cached = neon(url);
  return cached;
}

function asState(data) {
  const value = typeof data === "string" ? JSON.parse(data) : data;
  return {
    seasonKey: value?.seasonKey,
    seasonTitle: value?.seasonTitle,
    teams: Array.isArray(value?.teams) ? value.teams : [],
    players: Array.isArray(value?.players) ? value.players : [],
    matches: Array.isArray(value?.matches) ? value.matches : [],
  };
}

function asSeason(row) {
  return {
    id: row.id,
    label: row.label,
    archived: Boolean(row.archived_at),
    updatedAt: row.updated_at,
    data: asState(row.data),
  };
}

export async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      archived_at TIMESTAMPTZ,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function listSeasons(sql) {
  const rows = await sql`
    SELECT id, label, archived_at, updated_at
    FROM seasons
    ORDER BY archived_at NULLS FIRST, updated_at DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    archived: Boolean(row.archived_at),
    updatedAt: row.updated_at,
  }));
}

export async function getSeason(sql, id) {
  const rows = await sql`SELECT * FROM seasons WHERE id = ${id} LIMIT 1`;
  return rows[0] ? asSeason(rows[0]) : null;
}

export async function getCurrentSeason(sql) {
  const rows = await sql`
    SELECT * FROM seasons
    WHERE archived_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (rows[0]) return asSeason(rows[0]);
  const id = `s_${Date.now().toString(36)}`;
  const label = "2026/27";
  const empty = { seasonTitle: label, teams: [], players: [], matches: [] };
  await sql`
    INSERT INTO seasons (id, label, data)
    VALUES (${id}, ${label}, ${JSON.stringify(empty)}::jsonb)
  `;
  return { id, label, archived: false, updatedAt: new Date().toISOString(), data: empty };
}

export async function saveSeason(sql, id, data) {
  const payload = asState(data);
  const rows = await sql`
    UPDATE seasons
    SET data = ${JSON.stringify(payload)}::jsonb, updated_at = NOW()
    WHERE id = ${id} AND archived_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function archiveCurrent(sql, nextLabel) {
  const current = await getCurrentSeason(sql);
  await sql`UPDATE seasons SET archived_at = NOW(), updated_at = NOW() WHERE id = ${current.id}`;
  const id = `s_${Date.now().toString(36)}`;
  const label = nextLabel || "Nova sezona";
  const empty = { seasonTitle: label, teams: [], players: [], matches: [] };
  await sql`
    INSERT INTO seasons (id, label, data)
    VALUES (${id}, ${label}, ${JSON.stringify(empty)}::jsonb)
  `;
  return getCurrentSeason(sql);
}
