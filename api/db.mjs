import mysql from "mysql2/promise";
import { loadFileConfig } from "./config.mjs";
import { canEnterPins, teamPerms, teamRosterWindowOpen } from "./access.mjs";
import { applyLineup, lineupLocked, sanitizeLineup, teamMatchSide } from "./lineup.mjs";
import {
  findInviteTeam,
  hashInviteToken,
  hashPassword,
  inviteExpiryIso,
  inviteStillOpen,
  newInviteToken,
} from "./passwords.mjs";
import { preserveSecrets } from "./sanitize.mjs";
import { setAdminPassword } from "./session.mjs";

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
  await syncAdminPassword(pool, seed);
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

export async function saveMatchLineup(pool, teamId, matchId, side, starters, bench, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return null;
  const matches = [...(current.data.matches ?? [])];
  const index = matches.findIndex((match) => match.id === matchId);
  if (index < 0) return null;
  const match = matches[index];
  const team = (current.data.teams ?? []).find((item) => item.id === teamId);
  if (!teamPerms(team).lineup) return null;
  const own = teamMatchSide(match, teamId);
  if (own == null || own !== side) return null;
  if (lineupLocked(match.rounds)) return null;
  const allowed = new Set(
    (current.data.players ?? []).filter((player) => player.teamId === teamId).map((player) => player.id),
  );
  const clean = sanitizeLineup(starters ?? [], bench ?? [], allowed);
  matches[index] = applyLineup(match, side, clean.starters, clean.bench);
  const ok = await saveSeason(pool, current.id, { ...current.data, matches });
  return ok ? getSeason(pool, current.id) : null;
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
      const starters = patch.side === "home" ? match.homeStarters : match.awayStarters;
      const bench = patch.side === "home" ? match.homeBench : match.awayBench;
      const allowed = new Set([...(starters ?? []), ...(bench ?? [])].filter(Boolean));
      if (pid && !allowed.has(pid)) {
        await conn.rollback();
        return null;
      }
      if (patch.side === "home") nextGame.homePlayerId = pid;
      else nextGame.awayPlayerId = pid;
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
    matches[index] = { ...match, rounds, status: filled ? "done" : "scheduled" };
    const nextData = { ...current.data, matches };
    const payload = preserveSecrets(asState(nextData), current.data, { lockPerms: !admin });
    await conn.execute(
      "UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL",
      [dump(payload), id],
    );
    await conn.commit();
    return getSeason(pool, id);
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

export async function saveTeamRoster(pool, teamId, roster, seasonId) {
  const current = seasonId ? await getSeason(pool, seasonId) : await getCurrentSeason(pool);
  if (!current || current.archived) return null;
  const team = (current.data.teams ?? []).find((item) => item.id === teamId);
  if (!teamPerms(team).roster || !teamRosterWindowOpen(current.data.matches)) return null;
  const incoming = Array.isArray(roster) ? roster : [];
  const cleaned = incoming
    .filter((player) => player && player.name)
    .map((player) => ({
      id: String(player.id || ""),
      teamId,
      name: String(player.name).trim(),
      gender: player.gender === "F" ? "F" : "M",
      bzsMember: Boolean(player.bzsMember),
    }))
    .filter((player) => player.id && player.name);
  const others = (current.data.players ?? []).filter((player) => player.teamId !== teamId);
  const ok = await saveSeason(pool, current.id, { ...current.data, players: [...others, ...cleaned] });
  return ok ? getSeason(pool, current.id) : null;
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
