import { tokenValid, readToken } from "./session.mjs";
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
} from "./db.mjs";

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

function isAdmin(req) {
  return tokenValid(readToken(req.headers.cookie));
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

    if (req.method === "GET") {
      const admin = isAdmin(req);
      let current = seasonId ? await getSeason(sql, seasonId) : await getCurrentSeason(sql);
      if (current?.training && !admin) {
        current = await getCurrentSeason(sql);
      }
      if (!current) {
        json(res, 404, { ok: false });
        return;
      }
      json(res, 200, {
        storage: "db",
        current,
        seasons: await listSeasons(sql, { includeTraining: admin }),
      });
      return;
    }

    if (!isAdmin(req)) {
      json(res, 401, { ok: false });
      return;
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      const id = body.id || (await getCurrentSeason(sql)).id;
      const ok = await saveSeason(sql, id, body.data);
      json(res, ok ? 200 : 409, { ok });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (body.action === "archive") {
        const current = await archiveCurrent(sql, body.id);
        json(res, 200, {
          storage: "db",
          current,
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "reopen") {
        const current = await reopenSeason(sql, body.id);
        json(res, 200, {
          storage: "db",
          current,
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "create") {
        const current = await createSeason(sql, body.label || "Nova sezona", body.data);
        json(res, 200, {
          storage: "db",
          current,
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
          current,
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
          current,
          seasons: await listSeasons(sql, { includeTraining: true }),
        });
        return;
      }
      if (body.action === "delete") {
        const current = await deleteSeason(sql, body.id);
        json(res, 200, {
          storage: "db",
          current,
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
