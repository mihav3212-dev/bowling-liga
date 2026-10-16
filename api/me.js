import { readSession, readToken } from "./_lib/session.mjs";
import { ensureSchema, getCurrentSeason, getSql } from "./_lib/db.mjs";

export async function handleMe(req, res) {
  const sql = getSql();
  if (sql) {
    try {
      await ensureSchema(sql);
    } catch {
      /* prijava naj še vedno pade na env geslo */
    }
  }
  const session = readSession(readToken(req.headers.cookie));
  let teamName = null;
  if (session.teamId && sql) {
    try {
      const current = await getCurrentSeason(sql);
      teamName = current?.data?.teams?.find((team) => team.id === session.teamId)?.name ?? null;
    } catch {
      teamName = null;
    }
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ admin: session.admin, teamId: session.teamId, teamName }));
}

export default async function handler(req, res) {
  await handleMe(req, res);
}

