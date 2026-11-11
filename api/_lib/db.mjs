import mysql from "mysql2/promise";
import { loadFileConfig } from "./config.mjs";
import { canEnterPins, teamPerms, teamRosterWindowOpen } from "./access.mjs";
import {
  applyLineup,
  applyPlayerSubstitution,
  lineupLocked,
  playerOnOtherLane,
  preserveSubstitutions,
  sanitizeLineup,
  teamMatchSide,
} from "./lineup.mjs";
import {
  findInviteTeam,
  hashInviteToken,
  hashPassword,
  inviteExpiryIso,
  inviteStillOpen,
  newInviteToken,
} from "./passwords.mjs";
import { cloneTeamsAndPlayers } from "./cloneRoster.mjs";
import { preserveSecrets } from "./sanitize.mjs";
import { setAdminPassword, setDisplayPassword } from "./session.mjs";

let cached;

function mysqlConfig() {
  const file = loadFileConfig()?.mysql;
  if (file?.host && file?.user && file?.database) {
    return {
      host: String(file.host),
      user: String(file.user),
      password: String(file.password ?? ""),
      database: String(file.database),
      port: Number(file.port || 3306),
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 8,
    };
  }
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

export function resetSql() {
  if (!cached) return;
  const pool = cached;
  cached = null;
  void pool.end().catch(() => undefined);
}

async function exec(pool, sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

function composePlayerName(firstName, surname) {
  return [String(surname || "").trim(), String(firstName || "").trim()].filter(Boolean).join(" ");
}

/** Shema 3 = ne zamenjuj več ime↔priimek (ročni popravki se ne smejo povrniti). */
function migratePlayerNames(value) {
  const prevSchema = Number(value?.playerNameSchema) || 1;
  const rawPlayers = Array.isArray(value?.players) ? value.players : [];
  return {
    players: rawPlayers,
    playerNameSchema: Math.max(prevSchema, 3),
  };
}

function asState(data, opts = {}) {
  let value = data;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") value = value ? JSON.parse(value) : {};
  const migrated = opts.migrateNames
    ? migratePlayerNames(value)
    : {
        players: Array.isArray(value?.players) ? value.players : [],
        playerNameSchema: Number(value?.playerNameSchema) || 1,
      };
  return {
    seasonKey: value?.seasonKey,
    seasonTitle: value?.seasonTitle,
    training: Boolean(value?.training),
    teams: Array.isArray(value?.teams) ? value.teams : [],
    players: migrated.players,
    playerNameSchema: migrated.playerNameSchema,
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
  const data = asState(row.data, { migrateNames: true });
  return {
    id: row.id,
    label: row.label,
    archived: Boolean(row.archived_at),
    training: Boolean(data.training),
    updatedAt: asIso(row.updated_at),
    data,
  };
}

/** Če je bila ob branju narejena migracija imen, jo takoj zapiši (enkrat). */
async function persistNameMigration(pool, season) {
  if (!season?.id || !season.data) return season;
  if ((Number(season.data.playerNameSchema) || 1) < 3) return season;
  const rows = await exec(pool, "SELECT data FROM seasons WHERE id = ? LIMIT 1", [season.id]);
  const raw = rows[0]?.data;
  let parsed = raw;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString("utf8");
  if (typeof parsed === "string") parsed = parsed ? JSON.parse(parsed) : {};
  if ((Number(parsed?.playerNameSchema) || 1) >= 3) return season;
  await exec(pool, "UPDATE seasons SET data = ?, updated_at = updated_at WHERE id = ?", [
    dump(season.data),
    season.id,
  ]);
  return season;
}

/** True, če je strežnikova sezona novejša od klientove baze (stari zavihek). */
export function isSeasonBaseStale(serverUpdatedAt, baseUpdatedAt) {
  if (!baseUpdatedAt) return false;
  const serverMs = Date.parse(String(serverUpdatedAt || ""));
  const baseMs = Date.parse(String(baseUpdatedAt || ""));
  if (!Number.isFinite(serverMs) || !Number.isFinite(baseMs)) return false;
  return serverMs > baseMs + 750;
}

function dump(data) {
  return JSON.stringify(data);
}

export async function ensureSchema(pool, seed) {
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
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS settings (
      name VARCHAR(64) NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS match_edit_locks (
      season_id VARCHAR(64) NOT NULL,
      match_id VARCHAR(64) NOT NULL,
      token VARCHAR(64) NOT NULL,
      label VARCHAR(128) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (season_id, match_id),
      KEY idx_match_edit_locks_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS season_snapshots (
      id VARCHAR(64) NOT NULL,
      season_id VARCHAR(64) NOT NULL,
      kind VARCHAR(32) NOT NULL,
      round_num INT NULL,
      label VARCHAR(255) NOT NULL,
      data MEDIUMTEXT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_season_snapshots_round (season_id, kind, round_num),
      KEY idx_season_snapshots_created (season_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS site_presence (
      viewer_id VARCHAR(64) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      seen_at DATETIME(3) NOT NULL,
      PRIMARY KEY (viewer_id),
      KEY idx_site_presence_seen (seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await syncAdminPassword(pool, seed);
  await syncDisplayPassword(pool);
}

const PRESENCE_KINDS = new Set(["tv", "standings", "results", "other"]);

export function presenceKindOf(kind) {
  return PRESENCE_KINDS.has(kind) ? kind : "other";
}

export function presenceViewerId(id) {
  const value = String(id || "").trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : "";
}

function emptyPresenceCounts() {
  return { ok: true, total: 0, tv: 0, standings: 0, results: 0, other: 0 };
}

/** Javni utrip. Šteje se zavihek, viden v zadnjih 90 sekundah. */
export async function touchSitePresence(pool, id, kind) {
  const viewerId = presenceViewerId(id);
  if (!viewerId) return { ok: false };
  await exec(
    pool,
    "DELETE FROM site_presence WHERE seen_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE)",
  );
  await exec(
    pool,
    `INSERT INTO site_presence (viewer_id, kind, seen_at)
     VALUES (?, ?, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE kind = VALUES(kind), seen_at = CURRENT_TIMESTAMP(3)`,
    [viewerId, presenceKindOf(kind)],
  );
  return { ok: true };
}

export async function countSitePresence(pool) {
  const rows = await exec(
    pool,
    `SELECT kind, COUNT(*) AS n
     FROM site_presence
     WHERE seen_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 90 SECOND)
     GROUP BY kind`,
  );
  const counts = emptyPresenceCounts();
  for (const row of rows) {
    const kind = presenceKindOf(row.kind);
    counts[kind] += Number(row.n) || 0;
  }
  counts.total = counts.tv + counts.standings + counts.results + counts.other;
  return counts;
}

/** Koliko obnovitvenih točk hranimo na sezono. */
export const SNAPSHOT_KEEP = 10;

function matchFullyFilled(match) {
  const rounds = match?.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0) return false;
  return rounds.every((round) =>
    (round.games ?? []).every((game) => game.homePins != null && game.awayPins != null),
  );
}

function isRoundComplete(data, roundNum) {
  const list = (data?.matches ?? []).filter((m) => Number(m.round) === Number(roundNum));
  return list.length > 0 && list.every(matchFullyFilled);
}

async function pruneSeasonSnapshots(pool, seasonId) {
  const rows = await exec(
    pool,
    `SELECT id FROM season_snapshots WHERE season_id = ? ORDER BY created_at DESC`,
    [seasonId],
  );
  if (rows.length <= SNAPSHOT_KEEP) return;
  const drop = rows.slice(SNAPSHOT_KEEP).map((row) => row.id);
  if (!drop.length) return;
  await exec(
    pool,
    `DELETE FROM season_snapshots WHERE id IN (${drop.map(() => "?").join(",")})`,
    drop,
  );
}

/**
 * Ko je celotno kolo odigrano — shrani / osveži obnovitveno točko, starih največ SNAPSHOT_KEEP.
 */
export async function ensureRoundSnapshot(pool, seasonId, roundNum) {
  const season = await getSeason(pool, seasonId);
  if (!season || season.archived || season.training) return null;
  const round = Math.floor(Number(roundNum));
  if (!Number.isFinite(round) || round < 1) return null;
  if (!isRoundComplete(season.data, round)) return null;

  const label = `Po ${round}. kolu`;
  const dataJson = dump(season.data);
  const existing = await exec(
    pool,
    `SELECT id FROM season_snapshots WHERE season_id = ? AND kind = 'round' AND round_num = ? LIMIT 1`,
    [season.id, round],
  );
  if (existing[0]?.id) {
    await exec(
      pool,
      `UPDATE season_snapshots SET label = ?, data = ?, created_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [label, dataJson, existing[0].id],
    );
  } else {
    const id = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await exec(
      pool,
      `INSERT INTO season_snapshots (id, season_id, kind, round_num, label, data, created_at)
       VALUES (?, ?, 'round', ?, ?, ?, CURRENT_TIMESTAMP(3))`,
      [id, season.id, round, label, dataJson],
    );
  }
  await pruneSeasonSnapshots(pool, season.id);
  return true;
}

export async function listSeasonSnapshots(pool, seasonId) {
  if (!seasonId) return [];
  const rows = await exec(
    pool,
    `SELECT id, season_id, kind, round_num, label, created_at
     FROM season_snapshots
     WHERE season_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [seasonId, SNAPSHOT_KEEP],
  );
  return rows.map((row) => ({
    id: row.id,
    seasonId: row.season_id,
    kind: row.kind,
    round: row.round_num == null ? null : Number(row.round_num),
    label: row.label,
    createdAt: asIso(row.created_at),
  }));
}

/** Ročna obnovitvena točka (admin). */
export async function createManualSnapshot(pool, seasonId, label) {
  const season = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!season || season.archived) return null;
  const name = String(label || "").trim() || "Ročna točka";
  const id = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await exec(
    pool,
    `INSERT INTO season_snapshots (id, season_id, kind, round_num, label, data, created_at)
     VALUES (?, ?, 'manual', NULL, ?, ?, CURRENT_TIMESTAMP(3))`,
    [id, season.id, name.slice(0, 255), dump(season.data)],
  );
  await pruneSeasonSnapshots(pool, season.id);
  return listSeasonSnapshots(pool, season.id);
}

export async function restoreSeasonSnapshot(pool, snapshotId) {
  const rows = await exec(pool, "SELECT * FROM season_snapshots WHERE id = ? LIMIT 1", [snapshotId]);
  const snap = rows[0];
  if (!snap) return null;
  const current = await getSeason(pool, snap.season_id);
  if (!current || current.archived) return null;
  const payload = preserveSecrets(asState(snap.data), current.data);
  const result = await exec(
    pool,
    "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
    [dump(payload), current.id],
  );
  if (!result.affectedRows) return null;
  return getSeason(pool, current.id);
}

/** Mehki zaklep vnosa tekme — opozorilo, ne trdi blok. */
export const MATCH_EDIT_LOCK_TTL_MS = 60_000;

function lockRowFresh(row, now = Date.now()) {
  if (!row?.updated_at) return false;
  const t = new Date(row.updated_at).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < MATCH_EDIT_LOCK_TTL_MS;
}

async function readMatchEditLock(pool, seasonId, matchId) {
  const rows = await exec(
    pool,
    "SELECT season_id, match_id, token, label, updated_at FROM match_edit_locks WHERE season_id = ? AND match_id = ? LIMIT 1",
    [seasonId, matchId],
  );
  return rows[0] ?? null;
}

async function writeMatchEditLock(pool, seasonId, matchId, token, label) {
  await exec(
    pool,
    `INSERT INTO match_edit_locks (season_id, match_id, token, label, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE token = VALUES(token), label = VALUES(label), updated_at = CURRENT_TIMESTAMP(3)`,
    [seasonId, matchId, token, label],
  );
}

/**
 * @returns {{ ok: true, held: true } | { ok: true, held: false, conflict: { label: string, updatedAt?: string } }}
 */
export async function claimMatchEditLock(pool, seasonId, matchId, token, label, { force = false } = {}) {
  const sid = String(seasonId || "").trim();
  const mid = String(matchId || "").trim();
  const tok = String(token || "").trim();
  const lab = String(label || "Nekdo").trim().slice(0, 128) || "Nekdo";
  if (!sid || !mid || !tok) return { ok: false, error: "invalid" };

  const existing = await readMatchEditLock(pool, sid, mid);
  if (existing && lockRowFresh(existing) && existing.token !== tok && !force) {
    return {
      ok: true,
      held: false,
      conflict: {
        label: String(existing.label || "Nekdo"),
        updatedAt: asIso(existing.updated_at),
      },
    };
  }
  await writeMatchEditLock(pool, sid, mid, tok, lab);
  return { ok: true, held: true };
}

export async function heartbeatMatchEditLock(pool, seasonId, matchId, token, label) {
  const sid = String(seasonId || "").trim();
  const mid = String(matchId || "").trim();
  const tok = String(token || "").trim();
  const lab = String(label || "Nekdo").trim().slice(0, 128) || "Nekdo";
  if (!sid || !mid || !tok) return { ok: false };

  const existing = await readMatchEditLock(pool, sid, mid);
  if (!existing || existing.token !== tok) {
    // Prevzemi, če je star / prazen; sicer conflict
    if (existing && lockRowFresh(existing) && existing.token !== tok) {
      return {
        ok: true,
        held: false,
        conflict: { label: String(existing.label || "Nekdo"), updatedAt: asIso(existing.updated_at) },
      };
    }
  }
  await writeMatchEditLock(pool, sid, mid, tok, lab);
  return { ok: true, held: true };
}

export async function releaseMatchEditLock(pool, seasonId, matchId, token) {
  const sid = String(seasonId || "").trim();
  const mid = String(matchId || "").trim();
  const tok = String(token || "").trim();
  if (!sid || !mid || !tok) return { ok: false };
  await exec(
    pool,
    "DELETE FROM match_edit_locks WHERE season_id = ? AND match_id = ? AND token = ?",
    [sid, mid, tok],
  );
  return { ok: true };
}

export async function syncAdminPassword(pool, seed) {
  const rows = await exec(pool, "SELECT value FROM settings WHERE name = ? LIMIT 1", ["admin_password"]);
  const fromDb = rows[0]?.value;
  if (typeof fromDb === "string" && fromDb.trim()) {
    setAdminPassword(fromDb.trim());
    return fromDb.trim();
  }
  const fromEnv = String(seed || process.env.ADMIN_PASSWORD || "").trim();
  if (fromEnv) {
    await exec(pool, "INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = name", [
      "admin_password",
      fromEnv,
    ]);
    setAdminPassword(fromEnv);
  }
  return fromEnv;
}

export async function syncDisplayPassword(pool) {
  const rows = await exec(pool, "SELECT value FROM settings WHERE name = ? LIMIT 1", ["display_password"]);
  const fromDb = rows[0]?.value;
  if (typeof fromDb === "string" && fromDb.trim()) {
    setDisplayPassword(fromDb.trim());
    return fromDb.trim();
  }
  setDisplayPassword("");
  return "";
}

/** Admin: nastavi ali zbriši geslo za TV prikaz. */
export async function setDisplayPasswordSetting(pool, password) {
  const pw = String(password ?? "").trim();
  if (!pw) {
    await exec(pool, "DELETE FROM settings WHERE name = ?", ["display_password"]);
    setDisplayPassword("");
    return { ok: true, hasDisplayPassword: false };
  }
  await exec(
    pool,
    "INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    ["display_password", pw],
  );
  setDisplayPassword(pw);
  return { ok: true, hasDisplayPassword: true };
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
  if (!rows[0]) return null;
  return persistNameMigration(pool, asSeason(rows[0]));
}

export async function getCurrentSeason(pool) {
  const rows = await exec(
    pool,
    `SELECT * FROM seasons
     WHERE archived_at IS NULL
     ORDER BY updated_at DESC`,
  );
  const current = rows.map(asSeason).find((season) => !season.training);
  if (current) return persistNameMigration(pool, current);
  const id = `s_${Date.now().toString(36)}`;
  const label = "2026/27";
  const empty = { seasonTitle: label, teams: [], players: [], matches: [], playerNameSchema: 3 };
  await exec(pool, "INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)", [id, label, dump(empty)]);
  return { id, label, archived: false, updatedAt: new Date().toISOString(), data: empty };
}

export async function saveSeason(pool, id, data, opts = {}) {
  const existing = await getSeason(pool, id);
  const payload = preserveSecrets(asState(data), existing?.data, opts);
  const result = await exec(
    pool,
    "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
    [dump(payload), id],
  );
  return result.affectedRows > 0;
}

/**
 * Celoten zapis sezone — zavrne, če ima klient starejšo bazo (baseUpdatedAt).
 * @returns {{ ok: true, season: object } | { ok: false, conflict?: boolean, season?: object }}
 */
export async function saveSeasonIfFresh(pool, id, data, opts = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false };
    }
    const current = asSeason(row);
    if (isSeasonBaseStale(current.updatedAt, opts.baseUpdatedAt)) {
      await conn.rollback();
      return { ok: false, conflict: true, season: current };
    }
    const payload = preserveSecrets(asState(data), current.data, opts);
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), id],
    );
    await conn.commit();
    return { ok: true, season: await getSeason(pool, id) };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
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

function sameIdList(a, b) {
  const left = Array.isArray(a) ? a.map((id) => String(id ?? "")) : [];
  const right = Array.isArray(b) ? b.map((id) => String(id ?? "")) : [];
  if (left.length !== right.length) return false;
  return left.every((id, i) => id === right[i]);
}

/**
 * Shrani sestavo ene strani. baseStarters/baseBench = kar klient še vidi v bazi;
 * če je stran medtem spremenjena, conflict (brez da bi druga stran povoila to).
 * @returns {object | null | { conflict: true, season: object }}
 */
export async function saveMatchLineup(pool, teamId, matchId, side, starters, bench, seasonId, opts = {}) {
  const admin = Boolean(opts.admin);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let id = seasonId;
    if (!id) {
      const [ids] = await conn.execute(
        `SELECT id FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      );
      id = ids[0]?.id;
    }
    if (!id) {
      await conn.rollback();
      return null;
    }
    const [rows] = await conn.execute(
      `SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return null;
    }
    const current = asSeason(row);
    const matches = [...(current.data.matches ?? [])];
    const index = matches.findIndex((match) => match.id === matchId);
    if (index < 0) {
      await conn.rollback();
      return null;
    }
    const match = matches[index];
    let rosterTeamId = teamId;
    if (admin) {
      rosterTeamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    } else {
      const team = (current.data.teams ?? []).find((item) => item.id === teamId);
      if (!teamPerms(team).lineup) {
        await conn.rollback();
        return null;
      }
      const own = teamMatchSide(match, teamId);
      if (own == null || own !== side) {
        await conn.rollback();
        return null;
      }
    }
    if (lineupLocked(match.rounds)) {
      await conn.rollback();
      return null;
    }
    if (Array.isArray(opts.baseStarters)) {
      const serverStarters = side === "home" ? match.homeStarters : match.awayStarters;
      const serverBench = side === "home" ? match.homeBench : match.awayBench;
      if (
        !sameIdList(serverStarters, opts.baseStarters) ||
        !sameIdList(serverBench ?? [], opts.baseBench ?? [])
      ) {
        await conn.rollback();
        return { conflict: true, season: current };
      }
    }
    const allowed = new Set(
      (current.data.players ?? []).filter((player) => player.teamId === rosterTeamId).map((player) => player.id),
    );
    const clean = sanitizeLineup(starters ?? [], bench ?? [], allowed);
    matches[index] = applyLineup(match, side, clean.starters, clean.bench);
    const payload = preserveSecrets(asState({ ...current.data, matches }), current.data, { lockPerms: true });
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), current.id],
    );
    await conn.commit();
    return getSeason(pool, current.id);
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Admin: ena tekma. Igralci gredo po oznakah A1–A4 / B1–B4, keglji iz vnosa.
 * @returns {object | null | { conflict: true, season: object }}
 */
export async function saveAdminMatch(pool, seasonId, incoming, opts = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let id = seasonId;
    if (!id) {
      const [ids] = await conn.execute(
        `SELECT id FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      );
      id = ids[0]?.id;
    }
    if (!id || !incoming?.id) {
      await conn.rollback();
      return null;
    }
    const [rows] = await conn.execute(
      `SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return null;
    }
    const current = asSeason(row);
    if (isSeasonBaseStale(current.updatedAt, opts.baseUpdatedAt)) {
      await conn.rollback();
      return { conflict: true, season: current };
    }
    const matches = [...(current.data.matches ?? [])];
    const index = matches.findIndex((match) => match.id === incoming.id);
    if (index < 0) {
      await conn.rollback();
      return null;
    }
    const match = matches[index];
    const players = current.data.players ?? [];
    const homeAllowed = new Set(players.filter((p) => p.teamId === match.homeTeamId).map((p) => p.id));
    const awayAllowed = new Set(players.filter((p) => p.teamId === match.awayTeamId).map((p) => p.id));
    const home = sanitizeLineup(incoming.homeStarters ?? [], incoming.homeBench ?? [], homeAllowed);
    const away = sanitizeLineup(incoming.awayStarters ?? [], incoming.awayBench ?? [], awayAllowed);
    let next = applyLineup(match, "home", home.starters, home.bench);
    next = applyLineup(next, "away", away.starters, away.bench);
    const inRounds = incoming.rounds ?? [];
    next = {
      ...next,
      rounds: next.rounds.map((round, ri) => ({
        games: round.games.map((game, gi) => {
          const cell = inRounds[ri]?.games?.[gi];
          if (!cell || typeof cell !== "object") return game;
          return {
            ...game,
            // Ohrani menjave in keglje iz klienta (ne samo keglje).
            homePlayerId: Object.prototype.hasOwnProperty.call(cell, "homePlayerId")
              ? cell.homePlayerId
              : game.homePlayerId,
            awayPlayerId: Object.prototype.hasOwnProperty.call(cell, "awayPlayerId")
              ? cell.awayPlayerId
              : game.awayPlayerId,
            homePins: Object.prototype.hasOwnProperty.call(cell, "homePins")
              ? cell.homePins
              : game.homePins,
            awayPins: Object.prototype.hasOwnProperty.call(cell, "awayPins")
              ? cell.awayPins
              : game.awayPins,
            lane: Object.prototype.hasOwnProperty.call(cell, "lane") ? cell.lane : game.lane,
          };
        }),
      })),
    };
    next = preserveSubstitutions(next);
    const filled = next.rounds.every((round) =>
      round.games.every((game) => game.homePins != null && game.awayPins != null),
    );
    matches[index] = { ...next, status: filled ? "done" : "scheduled" };
    const payload = preserveSecrets(asState({ ...current.data, matches }), current.data, { lockPerms: true });
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), current.id],
    );
    await conn.commit();
    const season = await getSeason(pool, current.id);
    if (filled) {
      try {
        await ensureRoundSnapshot(pool, current.id, match.round);
      } catch {
        /* ignore */
      }
    }
    return season;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Shrani eno celico (keglji / igralec). Admin sme vse strani; ekipa samo svojo.
 * FOR UPDATE prepreči, da dva hkratna vpisa drug drugemu zbrišeta polja.
 */
export async function saveMatchGame(pool, viewer, patch, seasonId) {
  const admin = Boolean(viewer?.admin);
  const teamId = viewer?.teamId || null;
  if (!admin && !teamId) return null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let id = seasonId;
    if (!id) {
      const [ids] = await conn.execute(
        `SELECT id FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      );
      id = ids[0]?.id;
    }
    if (!id) {
      await conn.rollback();
      return null;
    }
    const [rows] = await conn.execute(
      `SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return null;
    }
    const current = asSeason(row);
    const team = teamId ? (current.data.teams ?? []).find((item) => item.id === teamId) : null;
    if (!admin && !team) {
      await conn.rollback();
      return null;
    }
    const matches = [...(current.data.matches ?? [])];
    const index = matches.findIndex((match) => match.id === patch.matchId);
    if (index < 0) {
      await conn.rollback();
      return null;
    }
    const match = matches[index];
    if (!admin && teamMatchSide(match, teamId) == null) {
      await conn.rollback();
      return null;
    }
    const ri = Number(patch.roundIndex);
    const gi = Number(patch.gameIndex);
    const game = match.rounds?.[ri]?.games?.[gi];
    if (!game || (patch.side !== "home" && patch.side !== "away")) {
      await conn.rollback();
      return null;
    }
    const nextGame = { ...game };
    if ("pins" in patch) {
      const key = patch.side === "home" ? "homePins" : "awayPins";
      if (!admin && !canEnterPins(team, game[key] ?? null)) {
        await conn.rollback();
        return null;
      }
      nextGame[key] = patch.pins;
    }
    if ("playerId" in patch) {
      if (!admin) {
        if (!teamPerms(team).lineup) {
          await conn.rollback();
          return null;
        }
        if (teamMatchSide(match, teamId) !== patch.side) {
          await conn.rollback();
          return null;
        }
      }
      if (ri === 0 && lineupLocked(match.rounds)) {
        await conn.rollback();
        return null;
      }
      const pid = patch.playerId || "";
      const before = match;
      const after = preserveSubstitutions(
        applyPlayerSubstitution(match, ri, gi, patch.side, pid),
      );
      const beforeId =
        patch.side === "home"
          ? before.rounds?.[ri]?.games?.[gi]?.homePlayerId
          : before.rounds?.[ri]?.games?.[gi]?.awayPlayerId;
      const afterId =
        patch.side === "home"
          ? after.rounds?.[ri]?.games?.[gi]?.homePlayerId
          : after.rounds?.[ri]?.games?.[gi]?.awayPlayerId;
      // Če se ni spremenilo (npr. prepovedana vrnitev), zavrni.
      if (pid && beforeId === afterId && beforeId !== pid) {
        await conn.rollback();
        return null;
      }
      const filledAfter = after.rounds.every((round) =>
        round.games.every((item) => item.homePins != null && item.awayPins != null),
      );
      matches[index] = {
        ...after,
        status: filledAfter ? "done" : "scheduled",
        ...(filledAfter ? { liveOnTv: undefined } : {}),
      };
      if (filledAfter) delete matches[index].liveOnTv;
      const nextDataSub = { ...current.data, matches };
      const payloadSub = preserveSecrets(asState(nextDataSub), current.data, { lockPerms: !admin });
      await conn.execute(
        "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
        [dump(payloadSub), id],
      );
      await conn.commit();
      return getSeason(pool, id);
    }
    const rounds = match.rounds.map((round, r) =>
      r !== ri
        ? round
        : {
            games: round.games.map((item, g) => (g !== gi ? item : nextGame)),
          },
    );
    const filled = rounds.every((round) =>
      round.games.every((item) => item.homePins != null && item.awayPins != null),
    );
    matches[index] = {
      ...match,
      rounds,
      status: filled ? "done" : "scheduled",
      ...(filled ? { liveOnTv: undefined } : {}),
    };
    if (filled) delete matches[index].liveOnTv;
    const nextData = { ...current.data, matches };
    const payload = preserveSecrets(asState(nextData), current.data, { lockPerms: !admin });
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), id],
    );
    await conn.commit();
    const season = await getSeason(pool, id);
    if (filled) {
      try {
        await ensureRoundSnapshot(pool, id, match.round);
      } catch {
        /* obnovitvena točka ne sme podreti shranjevanja */
      }
    }
    return season;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Zamenjaj igralce ene ekipe. Zaklep + baseUpdatedAt preprečita, da star seznam povozi novejšega.
 * @returns {object | null | { conflict: true, season: object }}
 */
export async function saveTeamRoster(pool, teamId, roster, seasonId, opts = {}) {
  const admin = Boolean(opts.admin);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let id = seasonId;
    if (!id) {
      const [ids] = await conn.execute(
        `SELECT id FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      );
      id = ids[0]?.id;
    }
    if (!id) {
      await conn.rollback();
      return null;
    }
    const [rows] = await conn.execute(
      `SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return null;
    }
    const current = asSeason(row);
    if (isSeasonBaseStale(current.updatedAt, opts.baseUpdatedAt)) {
      await conn.rollback();
      return { conflict: true, season: current };
    }
    const team = (current.data.teams ?? []).find((item) => item.id === teamId);
    if (!team) {
      await conn.rollback();
      return null;
    }
    if (!admin) {
      if (!teamPerms(team).roster || !teamRosterWindowOpen(current.data.matches)) {
        await conn.rollback();
        return null;
      }
    }
    const incoming = Array.isArray(roster) ? roster : [];
    const cleaned = incoming
      .filter((player) => player && (player.name || player.firstName || player.surname))
      .map((player) => {
        const firstName = String(player.firstName ?? "").trim();
        const surname = String(player.surname ?? "").trim();
        const legacy = String(player.name ?? "").trim();
        let f = firstName;
        let s = surname;
        if (!f && !s && legacy) {
          const parts = legacy.split(/\s+/).filter(Boolean);
          if (parts.length === 1) f = parts[0];
          else if (parts.length > 1) {
            // PRIIMEK IME (kot na lestvici)
            s = parts[0];
            f = parts.slice(1).join(" ");
          }
        }
        const name = [s, f].filter(Boolean).join(" ") || legacy;
        return {
          id: String(player.id || ""),
          teamId,
          firstName: f,
          surname: s,
          name,
          gender: player.gender === "F" ? "F" : "M",
          bzsMember: Boolean(player.bzsMember),
        };
      })
      .filter((player) => player.id && player.name);
    const others = (current.data.players ?? []).filter((player) => player.teamId !== teamId);
    const nextData = {
      ...current.data,
      players: [...others, ...cleaned],
      playerNameSchema: Math.max(Number(current.data.playerNameSchema) || 1, 3),
    };
    const payload = preserveSecrets(asState(nextData), current.data, { lockPerms: !admin });
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), current.id],
    );
    await conn.commit();
    return getSeason(pool, current.id);
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
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
  const teams = (current.data.teams ?? []).map((team) => {
    if (team.id !== teamId) return team;
    const next = { ...team, passwordHash: hash };
    delete next.inviteHash;
    delete next.inviteExpires;
    return next;
  });
  const ok = await saveSeason(pool, current.id, { ...current.data, teams });
  return ok ? getSeason(pool, current.id) : null;
}

export async function createTeamInvite(pool, teamId, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return null;
  if (!(current.data.teams ?? []).some((team) => team.id === teamId)) return null;
  const token = newInviteToken();
  const expiresAt = inviteExpiryIso();
  const teams = (current.data.teams ?? []).map((team) =>
    team.id === teamId ? { ...team, inviteHash: hashInviteToken(token), inviteExpires: expiresAt } : team,
  );
  const ok = await saveSeason(pool, current.id, { ...current.data, teams });
  if (!ok) return null;
  const saved = await getSeason(pool, current.id);
  return saved ? { token, expiresAt, current: saved } : null;
}

export async function previewTeamInvite(pool, token, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current) return { ok: false, error: "invalid" };
  const team = findInviteTeam(current.data.teams, token);
  if (!team) return { ok: false, error: "invalid" };
  if (!inviteStillOpen(team)) return { ok: false, error: "expired" };
  return { ok: true, teamName: team.name ?? "", expiresAt: team.inviteExpires };
}

export async function claimTeamInvite(pool, token, password, seasonId) {
  const trimmed = String(password ?? "").trim();
  if (trimmed.length < 4) return { ok: false, error: "short" };
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return { ok: false, error: "invalid" };
  const team = findInviteTeam(current.data.teams, token);
  if (!team) return { ok: false, error: "invalid" };
  if (!inviteStillOpen(team)) return { ok: false, error: "expired" };
  const teams = (current.data.teams ?? []).map((item) => {
    if (item.id !== team.id) return item;
    const next = { ...item, passwordHash: hashPassword(trimmed) };
    delete next.inviteHash;
    delete next.inviteExpires;
    return next;
  });
  const ok = await saveSeason(pool, current.id, { ...current.data, teams });
  if (!ok) return { ok: false, error: "conflict" };
  return { ok: true, teamName: team.name ?? "" };
}

export async function createSeason(pool, label, data) {
  const id = `s_${Date.now().toString(36)}`;
  const payload = asState(data) || { seasonTitle: label, teams: [], players: [], matches: [] };
  if (!payload.seasonTitle) payload.seasonTitle = label;
  await exec(pool, "INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)", [id, label, dump(payload)]);
  return getSeason(pool, id);
}

/** Nova sezona z izbranimi ekipami iz obstoječe (vključno z gesli). */
export async function createSeasonFromSource(pool, label, sourceId, teamIds, includePlayers) {
  const source = await getSeason(pool, sourceId);
  if (!source || source.training) return null;
  const name = String(label || "").trim() || "Nova sezona";
  const cloned = cloneTeamsAndPlayers(
    source.data.teams ?? [],
    source.data.players ?? [],
    Array.isArray(teamIds) ? teamIds : [],
    Boolean(includePlayers),
  );
  return createSeason(pool, name, {
    seasonTitle: name,
    teams: cloned.teams,
    players: cloned.players,
    matches: [],
  });
}
