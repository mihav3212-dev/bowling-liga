import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + plain).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain, stored) {
  if (!plain || !stored || typeof stored !== "string") return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = createHash("sha256").update(salt + plain).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(next);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const INVITE_DAYS = 14;

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function inviteStillOpen(team) {
  if (!team?.inviteHash) return false;
  const exp = Date.parse(team.inviteExpires ?? "");
  return Number.isFinite(exp) && exp > Date.now();
}

export function hashesEqual(a, b) {
  const x = Buffer.from(String(a ?? ""), "utf8");
  const y = Buffer.from(String(b ?? ""), "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function findInviteTeam(teams, token) {
  const hash = hashInviteToken(token);
  return (teams ?? []).find((team) => hashesEqual(team.inviteHash, hash)) ?? null;
}

export function inviteExpiryIso() {
  return new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
}
