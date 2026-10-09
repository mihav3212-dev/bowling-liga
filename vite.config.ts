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
        const { cookieHeader, clearCookieHeader, isSecureRequest, passwordOk, readToken, signToken, tokenValid } =
          await import("./api/session.mjs");
        try {
          if (url === "/api/league") {
            const { handleLeague } = await import("./api/league.js");
            await handleLeague(req, res);
            return;
          }
          if (url === "/api/me") {
            send(res, 200, { admin: tokenValid(readToken(req.headers.cookie)) });
            return;
          }
          if (url === "/api/logout") {
            send(res, 200, { ok: true }, clearCookieHeader(isSecureRequest(req)));
            return;
          }
          if (url === "/api/login" && req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { password?: string };
            if (!passwordOk(body.password ?? "")) {
              send(res, 401, { ok: false });
              return;
            }
            send(res, 200, { ok: true }, cookieHeader(signToken(), isSecureRequest(req)));
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
