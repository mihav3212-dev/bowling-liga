import { cookieHeader, isSecureRequest, passwordOk, signToken } from "./session.mjs";
import { verifyPassword } from "./passwords.mjs";
import { ensureSchema, getCurrentSeason, getSql } from "./db.mjs";

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function json(res, status, body, cookie) {
  res.statusCode = status;
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function findTeam(teams, password) {
  return (teams ?? []).find((team) => team.passwordHash && verifyPassword(password, team.passwordHash));
}

export async function handleLogin(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const body = await readBody(req);
    const password = body.password;
    const secure = isSecureRequest(req);
    const sql = getSql();
    if (sql) await ensureSchema(sql);
    if (passwordOk(password)) {
      json(res, 200, { ok: true, admin: true }, cookieHeader(signToken({ a: 1 }), secure));
      return;
    }
    if (sql) {
      const current = await getCurrentSeason(sql);
      const team = findTeam(current?.data?.teams, password);
      if (team) {
        json(
          res,
          200,
          { ok: true, admin: false, teamId: team.id, teamName: team.name },
          cookieHeader(signToken({ t: team.id }), secure),
        );
        return;
      }
    }
    json(res, 401, { ok: false });
  } catch {
    res.statusCode = 400;
    res.end();
  }
}

export default async function handler(req, res) {
  await handleLogin(req, res);
}

