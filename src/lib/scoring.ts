import type { DuelResult, GameScore, Match, MatchTotals, Player } from "./types";

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

export function bonusPoints(adjusted: number): number {
  if (adjusted > BONUS_DOUBLE) return 2;
  if (adjusted > BONUS_SINGLE) return 1;
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

export function scoreGame(
  game: GameScore,
  players: Player[],
): DuelResult | null {
  if (game.homePins == null || game.awayPins == null) return null;
  const home = playerById(players, game.homePlayerId);
  const away = playerById(players, game.awayPlayerId);
  if (!home || !away) return null;
  return scoreDuel(game.homePins, game.awayPins, home, away);
}

export function matchTotals(match: Match, players: Player[]): MatchTotals {
  let homeSmall = 0;
  let awaySmall = 0;
  let homePins = 0;
  let awayPins = 0;
  let scored = 0;
  const expected = ROUNDS * PLAYERS_ON_LANE;

  for (const round of match.rounds) {
    for (const game of round.games) {
      if (game.homePins != null) homePins += game.homePins;
      if (game.awayPins != null) awayPins += game.awayPins;
      const duel = scoreGame(game, players);
      if (!duel) continue;
      scored += 1;
      homeSmall += duel.homeTotal;
      awaySmall += duel.awayTotal;
    }
  }

  const complete = scored === expected;
  // Točke ekipe: zmaga 2, remi 1, poraz 0 — glede na seštevek malih točk igralcev.
  let homeBig = 0;
  let awayBig = 0;
  if (complete) {
    if (homeSmall > awaySmall) homeBig = 2;
    else if (awaySmall > homeSmall) awayBig = 2;
    else {
      homeBig = 1;
      awayBig = 1;
    }
  }

  return { homeSmall, awaySmall, homeBig, awayBig, homePins, awayPins, complete };
}

export function standingSortKey(row: {
  big: number;
  small: number;
  pins: number;
}): [number, number, number] {
  return [row.big, row.small, row.pins];
}
