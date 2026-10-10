import { matchTotals } from "./scoring";
import type { LeagueState } from "./types";

export type RecapLine = {
  rank?: number;
  showRank: boolean;
  value: number;
  name: string;
  team?: string;
};

export type WeekRecap = {
  bestSingle: RecapLine[];
  bestSeries: RecapLine[];
  bestTeam: RecapLine[];
  topSingles: RecapLine[];
  topSeries: RecapLine[];
  topTeams: RecapLine[];
};

function firstPlace(items: RecapLine[]): RecapLine[] {
  if (items.length === 0) return [];
  const top = Math.max(...items.map((item) => item.value));
  return items
    .filter((item) => item.value === top)
    .sort((a, b) => a.name.localeCompare(b.name, "sl"));
}

/** Prvih 5 mest; izenačeni na istem rezultatu ostanejo na istem mestu. */
export function topPlaces(items: RecapLine[], places = 5): RecapLine[] {
  const sorted = [...items].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name, "sl");
  });
  const out: RecapLine[] = [];
  let last: number | null = null;
  let distinct = 0;
  let rank = 0;
  for (const item of sorted) {
    if (last !== item.value) {
      if (distinct >= places) break;
      distinct += 1;
      rank = distinct;
      last = item.value;
      out.push({ ...item, rank, showRank: true });
    } else {
      out.push({ ...item, rank, showRank: false });
    }
  }
  return out;
}

function playerSeries(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const players = new Map(state.players.map((p) => [p.id, p]));
  const series = new Map<string, RecapLine & { games: number }>();

  const add = (playerId: string, matchId: string, pins: number) => {
    const player = players.get(playerId);
    if (!player) return;
    const key = `${matchId}:${playerId}`;
    const prev = series.get(key);
    if (prev) {
      prev.value += pins;
      prev.games += 1;
      return;
    }
    series.set(key, {
      showRank: false,
      value: pins,
      name: player.name,
      team: teams.get(player.teamId),
      games: 1,
    });
  };

  for (const match of state.matches) {
    for (const round of match.rounds) {
      for (const game of round.games) {
        if (game.homePins != null) add(game.homePlayerId, match.id, game.homePins);
        if (game.awayPins != null) add(game.awayPlayerId, match.id, game.awayPins);
      }
    }
  }

  return [...series.values()].filter((row) => row.games === 4);
}

function singles(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const players = new Map(state.players.map((p) => [p.id, p]));
  const rows: RecapLine[] = [];

  for (const match of state.matches) {
    for (const round of match.rounds) {
      for (const game of round.games) {
        if (game.homePins != null) {
          const player = players.get(game.homePlayerId);
          if (player) {
            rows.push({
              showRank: false,
              value: game.homePins,
              name: player.name,
              team: teams.get(player.teamId),
            });
          }
        }
        if (game.awayPins != null) {
          const player = players.get(game.awayPlayerId);
          if (player) {
            rows.push({
              showRank: false,
              value: game.awayPins,
              name: player.name,
              team: teams.get(player.teamId),
            });
          }
        }
      }
    }
  }
  return rows;
}

function teamMatches(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const rows: RecapLine[] = [];
  for (const match of state.matches) {
    const totals = matchTotals(match, state.players);
    if (!totals.complete) continue;
    rows.push({
      showRank: false,
      value: totals.homePins,
      name: teams.get(match.homeTeamId) ?? "?",
    });
    rows.push({
      showRank: false,
      value: totals.awayPins,
      name: teams.get(match.awayTeamId) ?? "?",
    });
  }
  return rows;
}

export function computeWeekRecap(state: LeagueState): WeekRecap {
  const singleRows = singles(state);
  const seriesRows = playerSeries(state);
  const teamRows = teamMatches(state);
  return {
    bestSingle: firstPlace(singleRows),
    bestSeries: firstPlace(seriesRows),
    bestTeam: firstPlace(teamRows),
    topSingles: topPlaces(singleRows),
    topSeries: topPlaces(seriesRows),
    topTeams: topPlaces(teamRows),
  };
}

export function recapHasData(recap: WeekRecap): boolean {
  return recap.bestSingle.length > 0 || recap.bestTeam.length > 0;
}
