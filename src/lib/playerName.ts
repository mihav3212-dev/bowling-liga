import type { Player } from "./types";

/** Združi v »PRIIMEK IME« (lestvice, seznami). */
export function composePlayerName(firstName: string, surname: string): string {
  return [surname.trim(), firstName.trim()].filter(Boolean).join(" ");
}

/**
 * Razcepi staro eno polje. Privzeto: zadnja beseda = priimek, preostalo = ime
 * (večina obstoječih vnosov je »IME PRIIMEK«). »M. NOVAK« → ime začetnica, priimek poln.
 * Če je bilo vneseno »PRIIMEK IME«, se da v urejanju zamenjati.
 */
export function splitPlayerName(raw: string): { firstName: string; surname: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", surname: "" };
  if (parts.length === 1) return { firstName: parts[0]!, surname: "" };
  if (/^[^\s.]{1,3}\.$/u.test(parts[0]!)) {
    return { firstName: parts[0]!, surname: parts.slice(1).join(" ") };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1]!,
  };
}

export function playerDisplayName(
  p: Pick<Player, "name" | "firstName" | "surname"> | { name?: string; firstName?: string; surname?: string },
): string {
  const composed = composePlayerName(p.firstName ?? "", p.surname ?? "");
  if (composed) return composed;
  const legacy = (p.name ?? "").trim();
  return legacy || "—";
}

/** TV pregled v eni vrstici: ime + začetnica priimka. */
export function shortTvPersonNameFromParts(firstName: string, surname: string): string {
  const f = firstName.trim();
  const s = surname.trim();
  if (!f && !s) return "—";
  if (!s) return f || "—";
  if (!f) return s;
  const initial = [...s][0]?.toUpperCase() ?? s.charAt(0).toUpperCase();
  return `${f} ${initial}.`;
}

export function normalizePlayer(
  raw: Partial<Player> & { id: string; teamId: string },
): Player {
  let firstName = String(raw.firstName ?? "").trim();
  let surname = String(raw.surname ?? "").trim();
  if (!firstName && !surname) {
    const split = splitPlayerName(String(raw.name ?? ""));
    firstName = split.firstName;
    surname = split.surname;
  }
  firstName = firstName.toLocaleUpperCase("sl");
  surname = surname.toLocaleUpperCase("sl");
  return {
    id: raw.id,
    teamId: raw.teamId,
    firstName,
    surname,
    name: composePlayerName(firstName, surname) || String(raw.name ?? "").trim().toLocaleUpperCase("sl"),
    gender: raw.gender === "F" ? "F" : "M",
    bzsMember: Boolean(raw.bzsMember),
  };
}

export function normalizePlayers(players: Player[] | undefined | null): Player[] {
  if (!Array.isArray(players)) return [];
  return players
    .filter((p) => p && p.id && p.teamId)
    .map((p) => normalizePlayer(p));
}

export function normalizeLeagueState<T extends { players?: Player[] | null }>(state: T): T {
  return { ...state, players: normalizePlayers(state.players) };
}
