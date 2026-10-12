import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

function send(res: ServerResponse, status: number, body: unknown, cookies?: string) {
  res.statusCode = status;
  if (cookies) res.setHeader("Set-Cookie", cookies);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function adminApi(): Plugin {
  return {
    name: "admin-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split("?")[0];
        if (!url?.startsWith("/api/")) {
          next();
          return;
        }
        const { clearCookieHeader, isSecureRequest } = await import("./api/session.mjs");
        try {
          if (url === "/api/league") {
            const { handleLeague } = await import("./api/league.js");
            await handleLeague(req, res);
            return;
          }
          if (url === "/api/me") {
            const { handleMe } = await import("./api/me.js");
            await handleMe(req, res);
            return;
          }
          if (url === "/api/logout") {
            send(res, 200, { ok: true }, clearCookieHeader(isSecureRequest(req)));
            return;
          }
          if (url === "/api/login" && req.method === "POST") {
            const { handleLogin } = await import("./api/login.js");
            await handleLogin(req, res);
            return;
          }
          send(res, 404, { ok: false });
        } catch {
          send(res, 400, { ok: false });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.POSTGRES_URL) process.env.POSTGRES_URL = env.POSTGRES_URL;
  return {
    plugins: [react(), adminApi()],
  };
});
