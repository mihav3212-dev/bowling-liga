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

/**
 * 3 = vnos Ime|Priimek; shranjeno firstName/surname v pravem pomenu.
 * Ob 1→3 (ali 1→2) enkrat zamenjaj obrnjene vnose; 2→3 samo dvigne oznako (brez nove zamenjave).
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

/** Poravnaj firstName/surname (lestvica ostane Priimek Ime). */
export function normalizeLeagueState<
  T extends { players?: Player[] | null; playerNameSchema?: number },
>(state: T): T {
  const prevSchema = state.playerNameSchema ?? 1;
  const rawPlayers = Array.isArray(state.players) ? state.players : [];
  const players = rawPlayers
    .filter((p) => p && p.id && p.teamId)
    .map((raw) => {
      const hadParts =
        Boolean(String(raw.firstName ?? "").trim()) || Boolean(String(raw.surname ?? "").trim());
      let player = normalizePlayer(raw);
      // Samo iz sheme 1: ena zamenjava. Shema 2 je že poravnala.
      if (prevSchema < 2 && hadParts) {
        player = swapPlayerNameParts(player);
      }
      return player;
    });
  return {
    ...state,
    players,
    playerNameSchema: Math.max(prevSchema, PLAYER_NAME_SCHEMA),
  };
}
