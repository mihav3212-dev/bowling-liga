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
    training: Boolean(value?.training),
    teams: Array.isArray(value?.teams) ? value.teams : [],
    players: Array.isArray(value?.players) ? value.players : [],
    matches: Array.isArray(value?.matches) ? value.matches : [],
    roundNotes: value?.roundNotes && typeof value.roundNotes === "object" ? value.roundNotes : undefined,
    roundLabels: value?.roundLabels && typeof value.roundLabels === "object" ? value.roundLabels : undefined,
    trainingSessions: Array.isArray(value?.trainingSessions) ? value.trainingSessions : undefined,
  };
}

function asSeason(row) {
  const data = asState(row.data);
  return {
    id: row.id,
    label: row.label,
    archived: Boolean(row.archived_at),
    training: Boolean(data.training),
    updatedAt: row.updated_at,
    data,
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

export async function listSeasons(sql, { includeTraining = false } = {}) {
  const rows = await sql`
    SELECT id, label, archived_at, updated_at, data
    FROM seasons
    ORDER BY archived_at NULLS FIRST, updated_at DESC
  `;
  return rows
    .map((row) => {
      const training = Boolean(asState(row.data).training);
      return {
        id: row.id,
        label: row.label,
        archived: Boolean(row.archived_at),
        training,
        updatedAt: row.updated_at,
      };
    })
    .filter((row) => includeTraining || !row.training);
}

export async function getSeason(sql, id) {
  const rows = await sql`SELECT * FROM seasons WHERE id = ${id} LIMIT 1`;
  return rows[0] ? asSeason(rows[0]) : null;
}

export async function getCurrentSeason(sql) {
  const rows = await sql`
    SELECT * FROM seasons
    WHERE archived_at IS NULL
      AND COALESCE((data->>'training')::boolean, false) = false
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

export async function archiveCurrent(sql, id) {
  let targetId = id;
  if (!targetId) {
    const current = await getCurrentSeason(sql);
    targetId = current.id;
  }
  await sql`UPDATE seasons SET archived_at = NOW(), updated_at = NOW() WHERE id = ${targetId}`;
  return getSeason(sql, targetId);
}

export async function reopenSeason(sql, id) {
  let targetId = id;
  if (!targetId) {
    const rows = await sql`
      SELECT id FROM seasons
      WHERE archived_at IS NOT NULL
        AND (
          label ILIKE '%2026/2027%'
          OR label ILIKE '%2026/27%'
          OR data->>'seasonKey' = '2026-27'
        )
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    targetId = rows[0]?.id;
  }
  if (!targetId) return getCurrentSeason(sql);
  await sql`
    UPDATE seasons
    SET archived_at = NULL, updated_at = NOW()
    WHERE id = ${targetId}
  `;
  return getSeason(sql, targetId);
}

export async function replaceSeason(sql, id, data, label) {
  const current = await getSeason(sql, id);
  if (!current) return null;
  const payload = asState(data);
  const name = (label || payload.seasonTitle || current.label).trim();
  payload.seasonTitle = name;
  payload.training = Boolean(current.training);
  await sql`
    UPDATE seasons
    SET label = ${name},
        data = ${JSON.stringify(payload)}::jsonb,
        archived_at = NULL,
        updated_at = NOW()
    WHERE id = ${id}
  `;
  return getSeason(sql, id);
}

export async function renameSeason(sql, id, label) {
  const current = await getSeason(sql, id);
  if (!current) return null;
  const name = String(label || "").trim();
  if (!name) return current;
  const payload = asState({ ...current.data, seasonTitle: name });
  await sql`
    UPDATE seasons
    SET label = ${name},
        data = ${JSON.stringify(payload)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}
  `;
  return getSeason(sql, id);
}

export async function deleteSeason(sql, id) {
  const listed = await sql`
    SELECT id FROM seasons
    ORDER BY archived_at NULLS FIRST, updated_at DESC
  `;
  if (listed.length <= 1) {
    throw new Error("Zadnje sezone ni mogoče izbrisati.");
  }
  await sql`DELETE FROM seasons WHERE id = ${id}`;
  const nextId = listed.find((row) => row.id !== id)?.id;
  return getSeason(sql, nextId);
}

export async function createSeason(sql, label, data) {
  const id = `s_${Date.now().toString(36)}`;
  const payload = asState(data) || { seasonTitle: label, teams: [], players: [], matches: [] };
  if (!payload.seasonTitle) payload.seasonTitle = label;
  await sql`
    INSERT INTO seasons (id, label, data)
    VALUES (${id}, ${label}, ${JSON.stringify(payload)}::jsonb)
  `;
  return getSeason(sql, id);
}
