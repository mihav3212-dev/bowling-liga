import type { Player } from "./types";
import { playerDisplayName, shortTvPersonNameFromParts, splitPlayerName } from "./playerName";

export function playerTag(player: Player): string {
  const label = playerDisplayName(player);
  const bits = [];
  if (player.gender === "F") bits.push("+8");
  if (player.bzsMember) bits.push("BZS −8");
  return bits.length ? `${label} (${bits.join(", ")})` : label;
}

/**
 * TV pregled iz enega niza: „Miha Novak“ → „Miha N.“
 * Raje uporabi shortTvPersonNameFromParts, ko sta polji ločeni.
 */
export function shortTvPersonName(name: string): string {
  const { firstName, surname } = splitPlayerName(name);
  return shortTvPersonNameFromParts(firstName, surname);
}

export { playerDisplayName, shortTvPersonNameFromParts, splitPlayerName } from "./playerName";

/** Kolo sezone (razpored / rezultati): „3. kolo“ / „3. KOLO“. */
export function formatSeasonRound(n: number, style: "lower" | "upper" = "lower"): string {
  return style === "upper" ? `${n}. KOLO` : `${n}. kolo`;
}

/** Krog znotraj tekme (4 igre): „3. krog“ / „3. KROG“. */
export function formatMatchRound(n: number, style: "lower" | "upper" = "lower"): string {
  return style === "upper" ? `${n}. KROG` : `${n}. krog`;
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
