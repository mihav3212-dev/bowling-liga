import { PLAYERS_ON_LANE, ROUNDS } from "./scoring";
import type { MatchRound } from "./types";

/** 4 krogi: vsak domač igralec proti vsakemu gostu, vsakič na drugi stezi. */
export function pairingTemplate(): { homeSlot: number; awaySlot: number; lane: number }[][] {
  const rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const games = [];
    for (let h = 0; h < PLAYERS_ON_LANE; h++) {
      games.push({
        homeSlot: h,
        awaySlot: (h + r) % PLAYERS_ON_LANE,
        lane: ((h + r) % PLAYERS_ON_LANE) + 1,
      });
    }
    rounds.push(games);
  }
  return rounds;
}

export function emptyRounds(homeStarters: string[], awayStarters: string[]): MatchRound[] {
  return pairingTemplate().map((games) => ({
    games: games.map((g) => ({
      homePlayerId: homeStarters[g.homeSlot] ?? "",
      awayPlayerId: awayStarters[g.awaySlot] ?? "",
      lane: g.lane,
      homePins: null,
      awayPins: null,
    })),
  }));
}

export function nominatedIds(starters: string[], bench: string[]): string[] {
  return [...starters, ...bench].filter(Boolean);
}
