import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
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
        const { clearCookieHeader, isSecureRequest } = await import("./api/_lib/session.mjs");
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
          if (url === "/api/setup") {
            const { handleSetup } = await import("./api/setup.js");
            await handleSetup(req, res);
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

function copyPhpApi(): Plugin {
  return {
    name: "copy-php-api",
    closeBundle() {
      mkdirSync("dist/api", { recursive: true });
      cpSync("php", "dist/api", { recursive: true });
      mkdirSync("dist/data", { recursive: true });
      copyFileSync("public/.htaccess", "dist/.htaccess");
      console.log("Skopirano v dist: .htaccess in api/ (skrite datoteke: ls -la dist)");
    },
  };
}

/** Poskrbi, da je force-legacy skripta na začetku <head> (po Vite injectu modulov). */
function forceLegacyTvHtml(): Plugin {
  return {
    name: "force-legacy-tv-html",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!html.includes("__BOLING_FORCE_LEGACY__")) return html;
        const match = html.match(
          /<script>\s*\/\* Classic script[\s\S]*?__BOLING_FORCE_LEGACY__[\s\S]*?<\/script>/,
        );
        if (!match) return html;
        const snip = match[0];
        const without = html.replace(snip, "");
        return without.replace(/<head[^>]*>/i, (open) => `${open}\n    ${snip}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.MYSQL_URL) process.env.MYSQL_URL = env.MYSQL_URL;
  if (env.MYSQL_HOST) process.env.MYSQL_HOST = env.MYSQL_HOST;
  if (env.MYSQL_PORT) process.env.MYSQL_PORT = env.MYSQL_PORT;
  if (env.MYSQL_USER) process.env.MYSQL_USER = env.MYSQL_USER;
  if (env.MYSQL_PASSWORD) process.env.MYSQL_PASSWORD = env.MYSQL_PASSWORD;
  if (env.MYSQL_DATABASE) process.env.MYSQL_DATABASE = env.MYSQL_DATABASE;
  if (env.MYSQL_SOCKET) process.env.MYSQL_SOCKET = env.MYSQL_SOCKET;
  return {
    build: {
      cssTarget: "chrome75",
    },
    plugins: [
      react(),
      // LG webOS ~Chrome 79: index.html prisili legacy; modernTargets naj bo
      // še vedno dovolj nizek (brez ?. / ??), če bi modern lezel skozi.
      legacy({
        targets: ["chrome >= 63", "safari >= 11", "ios >= 11"],
        modernTargets: ["chrome >= 75", "safari >= 13", "firefox >= 70"],
        modernPolyfills: true,
        additionalLegacyPolyfills: [
          "regenerator-runtime/runtime",
          "core-js/modules/es.array.at.js",
          "core-js/modules/es.string.at-alternative.js",
        ],
      }),
      forceLegacyTvHtml(),
      adminApi(),
      copyPhpApi(),
    ],
  };
});
