import type { Player } from "./types";

/** Združi v »PRIIMEK IME« (lestvice, seznami). */
export function composePlayerName(firstName: string, surname: string): string {
  return [surname.trim(), firstName.trim()].filter(Boolean).join(" ");
}

/**
 * Razcepi staro eno polje v »PRIIMEK IME« (kot na lestvici in vnosu ekipe).
 * »M. NOVAK« → ime začetnica, priimek poln.
 */
export function splitPlayerName(raw: string): { firstName: string; surname: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", surname: "" };
  if (parts.length === 1) return { firstName: parts[0]!, surname: "" };
  if (/^[^\s.]{1,3}\.$/u.test(parts[0]!)) {
    return { firstName: parts[0]!, surname: parts.slice(1).join(" ") };
  }
  return {
    surname: parts[0]!,
    firstName: parts.slice(1).join(" "),
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

function foldName(s: string): string {
  return s.trim().toLocaleLowerCase("sl").replace(/\s+/g, " ");
}

/** Ali je igralec vodja ekipe (polje captain je prosto besedilo). */
export function playerMatchesCaptain(
  player: Pick<Player, "name" | "firstName" | "surname">,
  captain?: string | null,
): boolean {
  const cap = foldName(captain ?? "");
  if (!cap) return false;
  const n = normalizePlayer({
    id: "_",
    teamId: "_",
    name: player.name,
    firstName: player.firstName,
    surname: player.surname,
  });
  const variants = [
    n.name,
    composePlayerName(n.firstName, n.surname),
    composePlayerName(n.surname, n.firstName),
    `${n.firstName} ${n.surname}`,
    `${n.surname} ${n.firstName}`,
  ]
    .map(foldName)
    .filter(Boolean);
  return variants.some((v) => v === cap);
}

/** Abeceda po priimku, nato imenu; vodja ekipe vedno prvi. */
export function sortTeamRoster<T extends Pick<Player, "name" | "firstName" | "surname">>(
  players: T[],
  captain?: string | null,
): T[] {
  return [...players].sort((a, b) => {
    const aCap = playerMatchesCaptain(a, captain);
    const bCap = playerMatchesCaptain(b, captain);
    if (aCap !== bCap) return aCap ? -1 : 1;
    const aSur = (a.surname || splitPlayerName(a.name).surname).toLocaleUpperCase("sl");
    const bSur = (b.surname || splitPlayerName(b.name).surname).toLocaleUpperCase("sl");
    const bySur = aSur.localeCompare(bSur, "sl");
    if (bySur !== 0) return bySur;
    const aFirst = (a.firstName || splitPlayerName(a.name).firstName).toLocaleUpperCase("sl");
    const bFirst = (b.firstName || splitPlayerName(b.name).firstName).toLocaleUpperCase("sl");
    return aFirst.localeCompare(bFirst, "sl");
  });
}

/**
 * 3 = vnos Ime|Priimek; firstName/surname se ne smejo več samodejno zamenjavati.
 * (Stara migracija 1→2 je pri shranjevanju/osvežitvi podrla ročne popravke.)
 */
const PLAYER_NAME_SCHEMA = 3;

export function swapPlayerNameParts(player: Player): Player {
  return normalizePlayer({
    ...player,
    firstName: player.surname,
    surname: player.firstName,
    name: "",
  });
}

/** Normaliziraj igralce; nikoli več samodejno ne zamenjaj ime↔priimek. */
export function normalizeLeagueState<
  T extends { players?: Player[] | null; playerNameSchema?: number },
>(state: T): T {
  const prevSchema = state.playerNameSchema ?? 1;
  return {
    ...state,
    players: normalizePlayers(state.players),
    playerNameSchema: Math.max(prevSchema, PLAYER_NAME_SCHEMA),
  };
}
