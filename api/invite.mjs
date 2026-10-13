import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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
