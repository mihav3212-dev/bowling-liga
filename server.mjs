import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleLeague } from "./api/league.js";
import { handleLogin } from "./api/login.js";
import { handleMe } from "./api/me.js";
import { clearCookieHeader, isSecureRequest } from "./api/session.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = resolve(root, "dist");
const envFile = join(root, ".env");

if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(res, status, body, cookie) {
  res.statusCode = status;
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fileInDist(urlPath) {
  const path = decodeURIComponent((urlPath || "/").split("?")[0]);
  const full = resolve(dist, `.${path === "/" ? "/index.html" : path}`);
  if (!full.startsWith(dist + "/") && full !== dist) return null;
  return full;
}

function serveStatic(req, res) {
  let file = fileInDist(req.url || "/");
  if (!file) {
    res.statusCode = 403;
    res.end();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    file = join(dist, "index.html");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] || "application/octet-stream");
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  try {
    if (url === "/api/login") {
      await handleLogin(req, res);
      return;
    }
    if (url === "/api/me") {
      await handleMe(req, res);
      return;
    }
    if (url === "/api/setup") {
      const { handleSetup } = await import("./api/setup.js");
      await handleSetup(req, res);
      return;
    }
    if (url === "/api/league") {
      await handleLeague(req, res);
      return;
    }
    if (url === "/api/logout") {
      sendJson(res, 200, { ok: true }, clearCookieHeader(isSecureRequest(req)));
      return;
    }
    if (url.startsWith("/api/")) {
      sendJson(res, 404, { ok: false });
      return;
    }
    serveStatic(req, res);
  } catch {
    if (!res.headersSent) sendJson(res, 500, { ok: false });
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`Bowling liga http://${host}:${port}`);
});
