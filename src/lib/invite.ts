export const INVITE_DAYS = 14;
export const MIN_TEAM_PASSWORD = 4;

/** Brez I/O/0/1 — lažje prebrati iz Messengerja. */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteToken(token: string): string {
  return token.trim().toUpperCase().replace(/[^A-Z0-9]/gi, "");
}

/** Kratka koda ekipe (8 znakov), ne običajno geslo. */
export function looksLikeInviteCode(raw: string): boolean {
  const t = normalizeInviteToken(raw);
  return t.length === 8 && /^[A-HJ-NP-Z2-9]+$/.test(t);
}

export function formatInviteCode(token: string): string {
  const t = normalizeInviteToken(token);
  if (t.length === 8) return `${t.slice(0, 4)}-${t.slice(4)}`;
  return t;
}

export function newInviteToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  }
  return out;
}

export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeInviteToken(token));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function inviteLink(token: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", normalizeInviteToken(token));
  return url.toString();
}

export function inviteExpiryIso(): string {
  return new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
}

export function formatInviteUntil(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sl-SI", { day: "numeric", month: "long", year: "numeric" });
}

export function inviteStillOpen(team: { hasInvite?: boolean; inviteHash?: string; inviteExpires?: string }): boolean {
  if (!team.hasInvite && !team.inviteHash) return false;
  const exp = Date.parse(team.inviteExpires ?? "");
  return Number.isFinite(exp) && exp > Date.now();
}
