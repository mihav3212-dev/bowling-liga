import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "liga_admin";
const DAY = 24 * 60 * 60 * 1000;

let cachedAdmin = process.env.ADMIN_PASSWORD ?? "";

export function adminPassword() {
  return cachedAdmin || process.env.ADMIN_PASSWORD || "";
}

export function setAdminPassword(value) {
  if (typeof value === "string" && value.length) cachedAdmin = value;
}

function secret() {
  return adminPassword() || "missing-admin-password";
}

function hmac(value) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function sameHex(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signToken(payload = { a: 1 }) {
  const exp = String(Date.now() + 30 * DAY);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(`${exp}.${body}`);
  return `${exp}.${body}.${sig}`;
}

export function tokenValid(token) {
  return readSession(token).admin;
}

export function readSession(token) {
  const empty = { admin: false, teamId: null };
  if (!token || !adminPassword()) return empty;
  const parts = String(token).split(".");
  if (parts.length === 2) {
    const [exp, sig] = parts;
    if (!exp || !sig || Number(exp) < Date.now()) return empty;
    if (!sameHex(sig, hmac(exp))) return empty;
    return { admin: true, teamId: null };
  }
  if (parts.length !== 3) return empty;
  const [exp, body, sig] = parts;
  if (!exp || !body || !sig || Number(exp) < Date.now()) return empty;
  if (!sameHex(sig, hmac(`${exp}.${body}`))) return empty;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (data?.a) return { admin: true, teamId: null };
    if (typeof data?.t === "string" && data.t) return { admin: false, teamId: data.t };
  } catch {
    return empty;
  }
  return empty;
}

export function passwordOk(password) {
  const expected = adminPassword();
  if (!expected || typeof password !== "string") return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function cookieHeader(token, secure) {
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieHeader(secure) {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readToken(cookieHeader) {
  const match = String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : "";
}

export function isSecureRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim();
  return proto === "https" || Boolean(req.socket?.encrypted);
}
