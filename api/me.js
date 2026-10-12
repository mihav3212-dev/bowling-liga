import { readSession, readToken } from "./session.mjs";
import { ensureSchema, getCurrentSeason, getSql } from "./db.mjs";

export async function handleMe(req, res) {
  const session = readSession(readToken(req.headers.cookie));
  let teamName = null;
  if (session.teamId) {
    const sql = getSql();
    if (sql) {
      try {
        await ensureSchema(sql);
        const current = await getCurrentSeason(sql);
        teamName = current?.data?.teams?.find((team) => team.id === session.teamId)?.name ?? null;
      } catch {
        teamName = null;
      }
    }
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ admin: session.admin, teamId: session.teamId, teamName }));
}

