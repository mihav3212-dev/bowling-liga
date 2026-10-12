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
