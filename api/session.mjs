import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "liga_admin";
const DAY = 24 * 60 * 60 * 1000;

export function adminPassword() {
  return process.env.ADMIN_PASSWORD ?? "";
}

function secret() {
  return adminPassword() || "missing-admin-password";
}

export function signToken() {
  const exp = String(Date.now() + 30 * DAY);
  const sig = createHmac("sha256", secret()).update(exp).digest("hex");
  return `${exp}.${sig}`;
}

export function tokenValid(token) {
  if (!token || !adminPassword()) return false;
  const [exp, sig] = String(token).split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(exp).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
  const proto = req.headers["x-forwarded-proto"];
  return proto === "https";
}
