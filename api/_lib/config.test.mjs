import { afterEach, describe, expect, it } from "vitest";
import { isConfigured, mysqlConfigSource, mysqlFromEnv } from "./config.mjs";

const ENV_KEYS = [
  "DATABASE_URL",
  "MYSQL_URL",
  "MYSQL_HOST",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_PORT",
  "MYSQL_SOCKET",
];

const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("mysql env config", () => {
  it("treats MYSQL_* as configured (Vercel)", () => {
    delete process.env.DATABASE_URL;
    delete process.env.MYSQL_URL;
    process.env.MYSQL_HOST = "db.example.com";
    process.env.MYSQL_USER = "liga";
    process.env.MYSQL_PASSWORD = "secret";
    process.env.MYSQL_DATABASE = "bowling_liga";

    expect(mysqlFromEnv()?.host).toBe("db.example.com");
    expect(mysqlConfigSource()).toBe("env");
    expect(isConfigured()).toBe(true);
  });

  it("accepts DATABASE_URL", () => {
    delete process.env.MYSQL_HOST;
    delete process.env.MYSQL_USER;
    delete process.env.MYSQL_DATABASE;
    process.env.DATABASE_URL = "mysql://liga:secret@db.example.com:3306/bowling_liga";

    expect(mysqlFromEnv()?.uri).toMatch(/^mysql:\/\//);
    expect(isConfigured()).toBe(true);
  });

  it("is not configured without host/user/database", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    // File config may still exist in the repo workspace — only assert env helper.
    expect(mysqlFromEnv()).toBeNull();
  });
});
