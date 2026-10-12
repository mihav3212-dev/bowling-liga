import mysql from "mysql2/promise";
import { hashPassword } from "./passwords.mjs";
import { preserveSecrets } from "./sanitize.mjs";

let cached;

function mysqlConfig() {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL || "";
  if (url.startsWith("mysql://") || url.startsWith("mariadb://")) {
    return { uri: url, charset: "utf8mb4" };
  }
  const host = process.env.MYSQL_HOST || "";
  const user = process.env.MYSQL_USER || "";
  const database = process.env.MYSQL_DATABASE || "";
  if (!host || !user || !database) return null;
  const config = {
    host,
    user,
    password: process.env.MYSQL_PASSWORD || "",
    database,
    port: Number(process.env.MYSQL_PORT || 3306),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 8,
  };
  if (process.env.MYSQL_SOCKET) config.socketPath = process.env.MYSQL_SOCKET;
  return config;
}

export function getSql() {
  const config = mysqlConfig();
  if (!config) return null;
  if (!cached) cached = mysql.createPool(config);
  return cached;
}

async function exec(pool, sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

function asState(data) {
  let value = data;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") value = value ? JSON.parse(value) : {};
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
    teamTrainings:
      value?.teamTrainings && typeof value.teamTrainings === "object" ? value.teamTrainings : undefined,
  };
}

function asIso(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asSeason(row) {
  const data = asState(row.data);
  return {
    id: row.id,
    label: row.label,
    archived: Boolean(row.archived_at),
    training: Boolean(data.training),
    updatedAt: asIso(row.updated_at),
    data,
  };
}

function dump(data) {
  return JSON.stringify(data);
}

export async function ensureSchema(pool) {
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS seasons (
      id VARCHAR(64) NOT NULL,
      label VARCHAR(255) NOT NULL,
      archived_at DATETIME NULL DEFAULT NULL,
      data MEDIUMTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_seasons_archived_updated (archived_at, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function listSeasons(pool, { includeTraining = false } = {}) {
  const rows = await exec(
    pool,
    `SELECT id, label, archived_at, updated_at, data
     FROM seasons
     ORDER BY (archived_at IS NULL) DESC, updated_at DESC`,
  );
  return rows
    .map((row) => {
      const training = Boolean(asState(row.data).training);
      return {
        id: row.id,
        label: row.label,
        archived: Boolean(row.archived_at),
        training,
        updatedAt: asIso(row.updated_at),
      };
    })
    .filter((row) => includeTraining || !row.training);
}

export async function getSeason(pool, id) {
  const rows = await exec(pool, "SELECT * FROM seasons WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? asSeason(rows[0]) : null;
}

export async function getCurrentSeason(pool) {
  const rows = await exec(
    pool,
    `SELECT * FROM seasons
     WHERE archived_at IS NULL
     ORDER BY updated_at DESC`,
  );
  const current = rows.map(asSeason).find((season) => !season.training);
  if (current) return current;
  const id = `s_${Date.now().toString(36)}`;
  const label = "2026/27";
  const empty = { seasonTitle: label, teams: [], players: [], matches: [] };
  await exec(pool, "INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)", [id, label, dump(empty)]);
  return { id, label, archived: false, updatedAt: new Date().toISOString(), data: empty };
}

export async function saveSeason(pool, id, data) {
  const existing = await getSeason(pool, id);
  const payload = preserveSecrets(asState(data), existing?.data);
  const result = await exec(
    pool,
    "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
    [dump(payload), id],
  );
  return result.affectedRows > 0;
}

export async function archiveCurrent(pool, id) {
  let targetId = id;
  if (!targetId) {
    const current = await getCurrentSeason(pool);
    targetId = current.id;
  }
  await exec(pool, "UPDATE seasons SET archived_at = NOW(), updated_at = NOW() WHERE id = ?", [targetId]);
  return getSeason(pool, targetId);
}

export async function reopenSeason(pool, id) {
  let targetId = id;
  if (!targetId) {
    const rows = await exec(
      pool,
      `SELECT id, label, data FROM seasons
       WHERE archived_at IS NOT NULL
       ORDER BY updated_at DESC`,
    );
    const match = rows.find((row) => {
      const label = String(row.label || "").toLowerCase();
      const key = asState(row.data).seasonKey;
      return label.includes("2026/2027") || label.includes("2026/27") || key === "2026-27";
    });
    targetId = match?.id;
  }
  if (!targetId) return getCurrentSeason(pool);
  await exec(pool, "UPDATE seasons SET archived_at = NULL, updated_at = NOW() WHERE id = ?", [targetId]);
  return getSeason(pool, targetId);
}

export async function replaceSeason(pool, id, data, label) {
  const current = await getSeason(pool, id);
  if (!current) return null;
  const payload = preserveSecrets(asState(data), current.data);
  const name = (label || payload.seasonTitle || current.label).trim();
  payload.seasonTitle = name;
  payload.training = Boolean(current.training);
  await exec(
    pool,
    "UPDATE seasons SET label = ?, data = ?, archived_at = NULL, updated_at = NOW() WHERE id = ?",
    [name, dump(payload), id],
  );
  return getSeason(pool, id);
}

export async function renameSeason(pool, id, label) {
  const current = await getSeason(pool, id);
  if (!current) return null;
  const name = String(label || "").trim();
  if (!name) return current;
  const payload = asState({ ...current.data, seasonTitle: name });
  await exec(pool, "UPDATE seasons SET label = ?, data = ?, updated_at = NOW() WHERE id = ?", [
    name,
    dump(payload),
    id,
  ]);
  return getSeason(pool, id);
}

export async function deleteSeason(pool, id) {
  const listed = await exec(
    pool,
    "SELECT id FROM seasons ORDER BY (archived_at IS NULL) DESC, updated_at DESC",
  );
  if (listed.length <= 1) {
    throw new Error("Zadnje sezone ni mogoče izbrisati.");
  }
  await exec(pool, "DELETE FROM seasons WHERE id = ?", [id]);
  const nextId = listed.find((row) => row.id !== id)?.id;
  return getSeason(pool, nextId);
}

export async function saveTeamTrainings(pool, teamId, sessions, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return null;
  if (!(current.data.teams ?? []).some((team) => team.id === teamId)) return null;
  const data = {
    ...current.data,
    teamTrainings: { ...(current.data.teamTrainings ?? {}), [teamId]: Array.isArray(sessions) ? sessions : [] },
  };
  const ok = await saveSeason(pool, current.id, data);
  return ok ? getSeason(pool, current.id) : null;
}

export async function setTeamPassword(pool, teamId, password, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return null;
  const trimmed = String(password ?? "").trim();
  const hash = trimmed ? hashPassword(trimmed) : "";
  if (!(current.data.teams ?? []).some((team) => team.id === teamId)) return null;
  const teams = (current.data.teams ?? []).map((team) =>
    team.id === teamId ? { ...team, passwordHash: hash } : team,
  );
  const ok = await saveSeason(pool, current.id, { ...current.data, teams });
  return ok ? getSeason(pool, current.id) : null;
}

export async function createSeason(pool, label, data) {
  const id = `s_${Date.now().toString(36)}`;
  const payload = asState(data) || { seasonTitle: label, teams: [], players: [], matches: [] };
  if (!payload.seasonTitle) payload.seasonTitle = label;
  await exec(pool, "INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)", [id, label, dump(payload)]);
  return getSeason(pool, id);
}
