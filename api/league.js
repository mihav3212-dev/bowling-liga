import { readSession, readToken } from "./session.mjs";
import { sanitizeState } from "./sanitize.mjs";
import {
  archiveCurrent,
  createSeason,
  deleteSeason,
  renameSeason,
  replaceSeason,
  reopenSeason,
  ensureSchema,
  getCurrentSeason,
  getSeason,
  getSql,
  listSeasons,
  saveSeason,
  saveMatchGame,
  saveMatchLineup,
  saveTeamRoster,
  saveTeamTrainings,
  setTeamPassword,
  createTeamInvite,
  previewTeamInvite,
  claimTeamInvite,
} from "./db.mjs";
import { teamPerms } from "./access.mjs";

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function viewerOf(req) {
  return readSession(readToken(req.headers.cookie));
}

function presentSeason(season, viewer) {
  if (!season) return season;
  return {
    ...season,
    data: sanitizeState(season.data, viewer),
  };
}

export async function handleLeague(req, res) {
  const sql = getSql();
  if (!sql) {
    json(res, 200, { storage: "local" });
    return;
  }

  try {
    await ensureSchema(sql);
    const url = new URL(req.url || "/api/league", "http://localhost");
    const seasonId = url.searchParams.get("id");

    const viewer = viewerOf(req);

    if (req.method === "GET") {
      let current = seasonId ? await getSeason(sql, seasonId) : await getCurrentSeason(sql);
      if (current?.training && !viewer.admin) {
        current = await getCurrentSeason(sql);
      }
      if (!current) {
        json(res, 404, { ok: false });
        return;
      }
      json(res, 200, {
        storage: "db",
        current: presentSeason(current, viewer),
        seasons: await listSeasons(sql, { includeTraining: viewer.admin }),
      });
      return;
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      const id = body.id || (await getCurrentSeason(sql)).id;
      if (!viewer.admin) {
        const current = await getSeason(sql, id);
        const team = (current?.data?.teams ?? []).find((item) => item.id === viewer.teamId);
        if (!teamPerms(team).season) {
          json(res, 401, { ok: false });
          return;
        }
      }
      const ok = await saveSeason(sql, id, body.data, { lockPerms: !viewer.admin });
      json(res, ok ? 200 : 409, { ok });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (body.action === "previewInvite") {
        const result = await previewTeamInvite(sql, body.token, body.id);
        json(res, result.ok ? 200 : 400, result);
        return;
      }
      if (body.action === "claimInvite") {
        const result = await claimTeamInvite(sql, body.token, body.password, body.id);
        json(res, result.ok ? 200 : result.error === "conflict" ? 409 : 400, result);
        return;
      }
      if (body.action === "saveGame") {
        if (!viewer.admin && !viewer.teamId) {
          json(res, 401, { ok: false });
          return;
        }
        const current = await saveMatchGame(sql, viewer, body, body.id);
        if (!current) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: viewer.admin }),
        });
        return;
      }
      if (body.action === "saveRoster") {
        const teamId = viewer.teamId;
        if (!teamId) {
          json(res, 401, { ok: false });
          return;
        }
        const current = await saveTeamRoster(sql, teamId, body.players, body.id);
        if (!current) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: viewer.admin }),
        });
        return;
      }
      if (body.action === "saveLineup") {
        const teamId = viewer.teamId;
        if (!teamId) {
          json(res, 401, { ok: false });
          return;
        }
        const side = body.side === "away" ? "away" : body.side === "home" ? "home" : null;
        if (!side || !body.matchId) {
          json(res, 400, { ok: false });
          return;
        }
        const current = await saveMatchLineup(
          sql,
          teamId,
          body.matchId,
          side,
          body.starters,
          body.bench,
          body.id,
        );
        if (!current) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: viewer.admin }),
        });
        return;
      }
      if (body.action === "saveTraining") {
        const teamId = viewer.admin ? body.teamId : viewer.teamId;
        if (!teamId) {
          json(res, 401, { ok: false });
          return;
        }
        const current = await saveTeamTrainings(sql, teamId, body.sessions, body.id);
        if (!current) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: viewer.admin }),
        });
        return;
      }
      if (body.action === "setTeamPassword") {
        if (!viewer.admin) {
          json(res, 401, { ok: false });
          return;
        }
        const current = await setTeamPassword(sql, body.teamId, body.password, body.id);
        if (!current) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "createInvite") {
        if (!viewer.admin) {
          json(res, 401, { ok: false });
          return;
        }
        const created = await createTeamInvite(sql, body.teamId, body.id);
        if (!created) {
          json(res, 409, { ok: false });
          return;
        }
        json(res, 200, {
          ok: true,
          token: created.token,
          expiresAt: created.expiresAt,
          storage: "db",
          current: presentSeason(created.current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (!viewer.admin) {
        json(res, 401, { ok: false });
        return;
      }
      if (body.action === "archive") {
        const current = await archiveCurrent(sql, body.id);
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "reopen") {
        const current = await reopenSeason(sql, body.id);
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "create") {
        const current = await createSeason(sql, body.label || "Nova sezona", body.data);
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "replace") {
        const current = await replaceSeason(sql, body.id, body.data, body.label);
        if (!current) {
          json(res, 404, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "rename") {
        const current = await renameSeason(sql, body.id, body.label);
        if (!current) {
          json(res, 404, { ok: false });
          return;
        }
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "delete") {
        const current = await deleteSeason(sql, body.id);
        json(res, 200, {
          storage: "db",
          current: presentSeason(current, viewer),
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      json(res, 400, { ok: false });
      return;
    }

    json(res, 405, { ok: false });
  } catch (error) {
    json(res, 500, { ok: false, error: String(error?.message || error) });
  }
}

export default async function handler(req, res) {
  await handleLeague(req, res);
}
