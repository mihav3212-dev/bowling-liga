export const INVITE_DAYS = 14;
export const MIN_TEAM_PASSWORD = 4;

export function newInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function inviteLink(token: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", token);
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
