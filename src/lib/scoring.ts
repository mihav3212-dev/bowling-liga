import type { DuelResult, GameScore, Match, MatchRound, MatchTotals, Player } from "./types";

export const WOMEN_HANDICAP = 8;
export const BZS_PENALTY = 8;
export const BONUS_SINGLE = 220;
export const BONUS_DOUBLE = 240;
export const ROUNDS = 4;
export const PLAYERS_ON_LANE = 4;
export const MAX_BENCH = 2;
export const TEAM_COUNT = 13;

export function adjustedPins(raw: number, player: Player): number {
  let pins = raw;
  if (player.gender === "F") pins += WOMEN_HANDICAP;
  if (player.bzsMember) pins -= BZS_PENALTY;
  return pins;
}

/** Vpisana številka; za ženske +8, za člane BZS −8. */
export function scoredPins(raw: number | null, player?: Player): number | null {
  if (raw == null) return null;
  return player ? adjustedPins(raw, player) : raw;
}

/** Do 219 brez pribitka; 220–239 +1; 240–300 +2 (po pribitku/odbitku). */
export function bonusPoints(adjusted: number): number {
  if (adjusted >= BONUS_DOUBLE) return 2;
  if (adjusted >= BONUS_SINGLE) return 1;
  return 0;
}

export function duelPoints(homeAdjusted: number, awayAdjusted: number): {
  home: number;
  away: number;
} {
  if (homeAdjusted > awayAdjusted) return { home: 2, away: 0 };
  if (awayAdjusted > homeAdjusted) return { home: 0, away: 2 };
  return { home: 1, away: 1 };
}

export function scoreDuel(
  homePins: number,
  awayPins: number,
  homePlayer: Player,
  awayPlayer: Player,
): DuelResult {
  const homeAdjusted = adjustedPins(homePins, homePlayer);
  const awayAdjusted = adjustedPins(awayPins, awayPlayer);
  const duel = duelPoints(homeAdjusted, awayAdjusted);
  const homeBonus = bonusPoints(homeAdjusted);
  const awayBonus = bonusPoints(awayAdjusted);
  return {
    homeDuel: duel.home,
    awayDuel: duel.away,
    homeBonus,
    awayBonus,
    homeTotal: duel.home + homeBonus,
    awayTotal: duel.away + awayBonus,
    homeAdjusted,
    awayAdjusted,
  };
}

export function playerById(players: Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

/** Odsotnost: 0 kegljev proti vpisanim = poraz 0:2 (brez pribitkov na 0). */
export function scoreForfeit(
  homePins: number,
  awayPins: number,
  present?: Player,
): DuelResult | null {
  if (homePins === 0 && awayPins > 0) {
    const awayAdjusted = present ? adjustedPins(awayPins, present) : awayPins;
    const awayBonus = bonusPoints(awayAdjusted);
    return {
      homeDuel: 0,
      awayDuel: 2,
      homeBonus: 0,
      awayBonus,
      homeTotal: 0,
      awayTotal: 2 + awayBonus,
      homeAdjusted: 0,
      awayAdjusted,
    };
  }
  if (awayPins === 0 && homePins > 0) {
    const homeAdjusted = present ? adjustedPins(homePins, present) : homePins;
    const homeBonus = bonusPoints(homeAdjusted);
    return {
      homeDuel: 2,
      awayDuel: 0,
      homeBonus,
      awayBonus: 0,
      homeTotal: 2 + homeBonus,
      awayTotal: 0,
      homeAdjusted,
      awayAdjusted: 0,
    };
  }
  return null;
}

/** Brez igralca: samo surovi keglji (npr. oba mesti izpolnjeni, igralec še ni izbran). */
function scoreRawDuel(homePins: number, awayPins: number): DuelResult {
  const duel = duelPoints(homePins, awayPins);
  const homeBonus = bonusPoints(homePins);
  const awayBonus = bonusPoints(awayPins);
  return {
    homeDuel: duel.home,
    awayDuel: duel.away,
    homeBonus,
    awayBonus,
    homeTotal: duel.home + homeBonus,
    awayTotal: duel.away + awayBonus,
    homeAdjusted: homePins,
    awayAdjusted: awayPins,
  };
}

export function scoreGame(
  game: GameScore,
  players: Player[],
): DuelResult | null {
  if (game.homePins == null || game.awayPins == null) return null;

  const home = playerById(players, game.homePlayerId);
  const away = playerById(players, game.awayPlayerId);

  // 0 = manjkajoči igralec / ekipa; nasprotnik z več kot 0 zmaga (tudi brez izbranega igralca).
  const forfeit = scoreForfeit(
    game.homePins,
    game.awayPins,
    game.homePins === 0 ? away : home,
  );
  if (forfeit) return forfeit;

  if (home && away) {
    return scoreDuel(game.homePins, game.awayPins, home, away);
  }
  // Oba sta vpisala keglje, a igralec manjka v sestavi — štej surovo.
  return scoreRawDuel(game.homePins, game.awayPins);
}

export function matchTotals(match: Match, players: Player[]): MatchTotals {
  let homeSmall = 0;
  let awaySmall = 0;
  let homePins = 0;
  let awayPins = 0;
  let homeBig = 0;
  let awayBig = 0;
  let scored = 0;
  const expected = ROUNDS * PLAYERS_ON_LANE;
  const rounds: MatchTotals["rounds"] = [];

  for (const round of match.rounds) {
    let rh = 0;
    let ra = 0;
    let rph = 0;
    let rpa = 0;
    let rscored = 0;
    for (const game of round.games) {
      // Pri odsotnosti (0) ne štej ženskega +8 — ostane 0 kegljev.
      const homeP = playerById(players, game.homePlayerId);
      const awayP = playerById(players, game.awayPlayerId);
      const hp =
        game.homePins === 0
          ? 0
          : scoredPins(game.homePins, homeP);
      const ap =
        game.awayPins === 0
          ? 0
          : scoredPins(game.awayPins, awayP);
      if (hp != null) {
        homePins += hp;
        rph += hp;
      }
      if (ap != null) {
        awayPins += ap;
        rpa += ap;
      }
      const duel = scoreGame(game, players);
      if (!duel) continue;
      scored += 1;
      rscored += 1;
      homeSmall += duel.homeTotal;
      awaySmall += duel.awayTotal;
      rh += duel.homeTotal;
      ra += duel.awayTotal;
    }
    const roundDone = rscored === PLAYERS_ON_LANE;
    let rbh = 0;
    let rba = 0;
    if (roundDone) {
      if (rh > ra) rbh = 2;
      else if (ra > rh) rba = 2;
      else {
        rbh = 1;
        rba = 1;
      }
      homeBig += rbh;
      awayBig += rba;
    }
    rounds.push({
      homeSmall: rh,
      awaySmall: ra,
      homeBig: rbh,
      awayBig: rba,
      homePins: rph,
      awayPins: rpa,
      complete: roundDone,
    });
  }

  const complete = scored === expected;
  if (complete) {
    if (homePins > awayPins) homeBig += 2;
    else if (awayPins > homePins) awayBig += 2;
  }

  let homeMatch = 0;
  let awayMatch = 0;
  if (complete) {
    if (homeBig > awayBig) homeMatch = 2;
    else if (awayBig > homeBig) awayMatch = 2;
    else {
      homeMatch = 1;
      awayMatch = 1;
    }
  }

  return {
    homeSmall,
    awaySmall,
    homeBig,
    awayBig,
    homeMatch,
    awayMatch,
    homePins,
    awayPins,
    complete,
    rounds,
  };
}

export type MatchPlayerStat = {
  playerId: string;
  name: string;
  side: "home" | "away";
  games: number;
  pins: number;
  small: number;
  average: number | null;
};

/** Po igralcu v eni tekmi: male točke, keglji (s +8/−8), povprečje. */
export function matchPlayerStats(match: Match, players: Player[]): MatchPlayerStat[] {
  type Acc = { name: string; side: "home" | "away"; games: number; pins: number; small: number };
  const rows = new Map<string, Acc>();

  const bump = (
    playerId: string,
    side: "home" | "away",
    pins: number | null,
    small: number | null,
  ) => {
    if (!playerId || pins == null) return;
    const player = playerById(players, playerId);
    const key = `${side}:${playerId}`;
    const cur = rows.get(key) ?? {
      name: player?.name ?? "—",
      side,
      games: 0,
      pins: 0,
      small: 0,
    };
    cur.games += 1;
    cur.pins += pins;
    if (small != null) cur.small += small;
    rows.set(key, cur);
  };

  for (const round of match.rounds ?? []) {
    for (const game of round.games ?? []) {
      const homeP = playerById(players, game.homePlayerId);
      const awayP = playerById(players, game.awayPlayerId);
      const hp =
        game.homePins == null ? null : game.homePins === 0 ? 0 : scoredPins(game.homePins, homeP);
      const ap =
        game.awayPins == null ? null : game.awayPins === 0 ? 0 : scoredPins(game.awayPins, awayP);
      const duel = scoreGame(game, players);
      bump(game.homePlayerId, "home", hp, duel?.homeTotal ?? null);
      bump(game.awayPlayerId, "away", ap, duel?.awayTotal ?? null);
    }
  }

  return [...rows.entries()]
    .map(([key, row]) => {
      const playerId = key.slice(key.indexOf(":") + 1);
      return {
        playerId,
        name: row.name,
        side: row.side,
        games: row.games,
        pins: row.pins,
        small: row.small,
        average: row.games ? row.pins / row.games : null,
      };
    })
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "home" ? -1 : 1;
      return b.pins - a.pins || a.name.localeCompare(b.name, "sl");
    });
}

/** Ko so v 1. krogu vneseni keglji, sestave ni več mogoče spreminjati. */
export function lineupLocked(rounds: MatchRound[] | undefined): boolean {
  return Boolean(
    rounds?.[0]?.games.some((game) => game.homePins != null || game.awayPins != null),
  );
}

export function seasonIsComplete(state: { matches: Match[]; players: Player[] }): boolean {
  return state.matches.length > 0 && state.matches.every((m) => matchTotals(m, state.players).complete);
}

export function standingSortKey(row: {
  big: number;
  small: number;
  pins: number;
}): [number, number, number] {
  return [row.big, row.small, row.pins];
}
