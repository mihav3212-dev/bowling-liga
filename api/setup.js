import mysql from "mysql2/promise";
import { isConfigured, saveFileConfig } from "./config.mjs";
import { ensureSchema, getSql, resetSql } from "./db.mjs";
import { setAdminPassword } from "./session.mjs";

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

export async function handleSetup(req, res) {
  if (req.method === "GET") {
    json(res, 200, {
      needed: !isConfigured(),
      defaults: { host: "localhost", port: 3306, database: "bowling_liga" },
    });
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { ok: false });
    return;
  }

  if (isConfigured()) {
    json(res, 409, { ok: false, error: "Namestitev je že opravljena." });
    return;
  }

  try {
    const body = await readBody(req);
    const host = String(body.host || "localhost").trim();
    const user = String(body.user || "").trim();
    const password = String(body.password ?? "");
    const database = String(body.database || "").trim();
    const port = Number(body.port || 3306);
    const adminPassword = String(body.adminPassword || "").trim();
    if (!host || !user || !database || !adminPassword) {
      json(res, 400, { ok: false, error: "Izpolni gostitelja, uporabnika, bazo in admin geslo." });
      return;
    }

    const mysqlOpts = { host, user, password, database, port, charset: "utf8mb4" };
    const conn = await mysql.createConnection(mysqlOpts);
    await conn.query("SELECT 1");
    await conn.end();

    saveFileConfig({ mysql: { host, user, password, database, port } });
    resetSql();
    process.env.ADMIN_PASSWORD = adminPassword;
    setAdminPassword(adminPassword);
    const pool = getSql();
    if (!pool) {
      json(res, 500, { ok: false, error: "Povezava po shranjevanju ni uspela." });
      return;
    }
    await ensureSchema(pool, adminPassword);
    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 400, {
      ok: false,
      error: "MySQL povezava ni uspela. Preveri podatke in da baza v phpMyAdmin že obstaja.",
      detail: String(error?.message || error),
    });
  }
}

export default async function handler(req, res) {
  await handleSetup(req, res);
}
