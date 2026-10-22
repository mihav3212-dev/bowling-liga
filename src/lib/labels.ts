import type { Player } from "./types";

export function playerTag(player: Player): string {
  const bits = [];
  if (player.gender === "F") bits.push("+8");
  if (player.bzsMember) bits.push("BZS −8");
  return bits.length ? `${player.name} (${bits.join(", ")})` : player.name;
}

/**
 * TV pregled: „Novak David“ → „N. David“ (prva beseda začetnica, ostalo polno).
 * Če je že „N. David“ / ena beseda, pusti.
 */
export function shortTvPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  if (/^[^\s.]{1,3}\.$/u.test(first)) return parts.join(" ");
  const initial = [...first][0]?.toUpperCase() ?? first.charAt(0).toUpperCase();
  return `${initial}. ${parts.slice(1).join(" ")}`;
}

const WEEKDAYS_SL = ["NED", "PON", "TOR", "SRE", "ČET", "PET", "SOB"];

export function formatMatchWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = WEEKDAYS_SL[d.getDay()];
  const date = d.toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
  const time = d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${date} ${time}`;
}

export function parsePins(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 300) return null;
  return Math.round(n);
}
