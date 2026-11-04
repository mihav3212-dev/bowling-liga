import { matchTotals, scoredPins } from "./scoring";
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

/** Ključ osebe: ime + ekipa (isti človek z več ID-ji ne sme biti 2×). */
function personKey(row: Pick<RecapLine, "name" | "team"> & { playerId?: string }): string {
  const name = row.name.trim().toLocaleLowerCase("sl");
  const team = (row.team ?? "").trim().toLocaleLowerCase("sl");
  return `${name}|${team}`;
}

/** Vsak posameznik največ enkrat — najboljši izid. */
function bestPerPlayer(rows: (RecapLine & { playerId: string })[]): RecapLine[] {
  const best = new Map<string, RecapLine>();
  for (const row of rows) {
    const key = personKey(row);
    const prev = best.get(key);
    if (!prev || row.value > prev.value) {
      best.set(key, {
        showRank: false,
        value: row.value,
        name: row.name,
        team: row.team,
      });
    }
  }
  return [...best.values()];
}

function playerSeries(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const players = new Map(state.players.map((p) => [p.id, p]));
  const series = new Map<string, RecapLine & { playerId: string; games: number }>();

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
      playerId,
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
        if (game.homePins != null) {
          add(game.homePlayerId, match.id, scoredPins(game.homePins, players.get(game.homePlayerId)) ?? game.homePins);
        }
        if (game.awayPins != null) {
          add(game.awayPlayerId, match.id, scoredPins(game.awayPins, players.get(game.awayPlayerId)) ?? game.awayPins);
        }
      }
    }
  }

  return bestPerPlayer([...series.values()].filter((row) => row.games === 4));
}

function singles(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const players = new Map(state.players.map((p) => [p.id, p]));
  const rows: (RecapLine & { playerId: string })[] = [];

  for (const match of state.matches) {
    for (const round of match.rounds) {
      for (const game of round.games) {
        if (game.homePins != null) {
          const player = players.get(game.homePlayerId);
          if (player) {
            rows.push({
              playerId: player.id,
              showRank: false,
              value: scoredPins(game.homePins, player) ?? game.homePins,
              name: player.name,
              team: teams.get(player.teamId),
            });
          }
        }
        if (game.awayPins != null) {
          const player = players.get(game.awayPlayerId);
          if (player) {
            rows.push({
              playerId: player.id,
              showRank: false,
              value: scoredPins(game.awayPins, player) ?? game.awayPins,
              name: player.name,
              team: teams.get(player.teamId),
            });
          }
        }
      }
    }
  }
  return bestPerPlayer(rows);
}

/** Najboljši ekipni izid po tekmi — vsaka ekipa največ enkrat (max kegljev). */
function teamMatches(state: LeagueState): RecapLine[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const best = new Map<string, RecapLine>();
  const consider = (teamId: string, pins: number) => {
    const name = teams.get(teamId) ?? "?";
    const prev = best.get(teamId);
    if (!prev || pins > prev.value) {
      best.set(teamId, { showRank: false, value: pins, name });
    }
  };
  for (const match of state.matches) {
    const totals = matchTotals(match, state.players);
    if (!totals.complete) continue;
    consider(match.homeTeamId, totals.homePins);
    consider(match.awayTeamId, totals.awayPins);
  }
  return [...best.values()];
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
