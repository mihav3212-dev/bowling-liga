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

export function isConfigured() {
  const mysql = loadFileConfig()?.mysql;
  return Boolean(mysql?.host && mysql?.user && mysql?.database);
}

export function saveFileConfig(config) {
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
