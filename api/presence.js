import { readSession, readToken } from "./_lib/session.mjs";
import {
  countSitePresence,
  ensureSchema,
  getSql,
  presenceKindOf,
  presenceViewerId,
  touchSitePresence,
} from "./_lib/db.mjs";

const memory = new Map();
const PRESENCE_TTL_MS = 90_000;
const PRESENCE_PRUNE_MS = 10 * 60_000;

function pruneMemory(now) {
  for (const [id, row] of memory) {
    if (now - row.seen > PRESENCE_PRUNE_MS) memory.delete(id);
  }
}

function touchMemory(id, kind, now = Date.now()) {
  const viewerId = presenceViewerId(id);
  if (!viewerId) return { ok: false };
  pruneMemory(now);
  memory.set(viewerId, { kind: presenceKindOf(kind), seen: now });
  return { ok: true };
}

function countMemory(now = Date.now()) {
  const counts = { ok: true, total: 0, tv: 0, standings: 0, results: 0, other: 0 };
  for (const row of memory.values()) {
    if (now - row.seen > PRESENCE_TTL_MS) continue;
    counts[row.kind] += 1;
  }
  counts.total = counts.tv + counts.standings + counts.results + counts.other;
  return counts;
}

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

export async function handlePresence(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { ok: false });
    return;
  }
  try {
    const body = await readBody(req);
    const sql = getSql();
    if (sql) await ensureSchema(sql);
    if (body.action === "counts") {
      const viewer = readSession(readToken(req.headers.cookie));
      if (!viewer.admin) {
        json(res, 401, { ok: false });
        return;
      }
      json(res, 200, sql ? await countSitePresence(sql) : countMemory());
      return;
    }
    const result = sql
      ? await touchSitePresence(sql, body.id, body.kind)
      : touchMemory(body.id, body.kind);
    json(res, result.ok ? 200 : 400, result);
  } catch {
    json(res, 400, { ok: false });
  }
}

export default handlePresence;
