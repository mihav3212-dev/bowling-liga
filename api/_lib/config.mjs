import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const file = join(root, "data", "config.json");

export function loadFileConfig() {
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** MySQL from env (Vercel / Docker). Prefer DATABASE_URL / MYSQL_URL, else discrete MYSQL_*. */
export function mysqlFromEnv() {
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

export function mysqlFromFile() {
  const mysql = loadFileConfig()?.mysql;
  if (!mysql?.host || !mysql?.user || !mysql?.database) return null;
  return {
    host: String(mysql.host),
    user: String(mysql.user),
    password: String(mysql.password ?? ""),
    database: String(mysql.database),
    port: Number(mysql.port || 3306),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 8,
  };
}

/** "file" | "env" | null — file wins when both exist (local setup). */
export function mysqlConfigSource() {
  if (mysqlFromFile()) return "file";
  if (mysqlFromEnv()) return "env";
  return null;
}

export function isConfigured() {
  return mysqlConfigSource() != null;
}

export function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

export function saveFileConfig(config) {
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
