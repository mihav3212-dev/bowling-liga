import { matchTotals, scoreGame, scoredPins, standingSortKey } from "./scoring";
import type { LeagueState, Player, Team } from "./types";

export type StandingRow = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  big: number;
  velike: number;
  small: number;
  pins: number;
  games: number;
  avg: number;
  teamAvg: number;
  over200: number;
  over220: number;
  over240: number;
};

export function computeStandings(state: LeagueState): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const team of state.teams) {
    rows.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      big: 0,
      velike: 0,
      small: 0,
      pins: 0,
      games: 0,
      avg: 0,
      teamAvg: 0,
      over200: 0,
      over220: 0,
      over240: 0,
    });
  }

  for (const match of state.matches) {
    const totals = matchTotals(match, state.players);
    if (!totals.complete) continue;
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.velike += totals.homeBig;
    away.velike += totals.awayBig;
    home.big += totals.homeMatch;
    away.big += totals.awayMatch;
    home.small += totals.homeSmall;
    away.small += totals.awaySmall;
    home.pins += totals.homePins;
    away.pins += totals.awayPins;

    for (const round of match.rounds) {
      for (const game of round.games) {
        const hp = scoredPins(game.homePins, state.players.find((p) => p.id === game.homePlayerId));
        const ap = scoredPins(game.awayPins, state.players.find((p) => p.id === game.awayPlayerId));
        if (hp != null) {
          home.games += 1;
          bumpHighs(home, hp);
        }
        if (ap != null) {
          away.games += 1;
          bumpHighs(away, ap);
        }
      }
    }

    if (totals.homeMatch === 2) {
      home.won += 1;
      away.lost += 1;
    } else if (totals.awayMatch === 2) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
    }
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      avg: row.games ? row.pins / row.games : 0,
      teamAvg: row.played ? row.pins / row.played : 0,
    }))
    .sort((a, b) => {
    const ka = standingSortKey(a);
    const kb = standingSortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (kb[i] !== ka[i]) return kb[i] - ka[i];
    }
    return a.team.name.localeCompare(b.team.name, "sl");
  });
}

type HighCounts = {
  over200: number;
  over220: number;
  over240: number;
};

function bumpHighs(row: HighCounts, pins: number): void {
  if (pins >= 200) row.over200 += 1;
  if (pins >= 220) row.over220 += 1;
  if (pins >= 240) row.over240 += 1;
}

export type PlayerStandingRow = {
  player: Player;
  teamName: string;
  games: number;
  points: number;
  pins: number;
  avg: number;
  best: number;
  over200: number;
  over220: number;
  over240: number;
  /** Keglji po kolih (do 4 igre na kolo). */
  byRound: number[][];
};

export function seasonRoundCount(state: LeagueState): number {
  const maxRound = Math.max(0, ...state.matches.map((m) => m.round));
  return maxRound || 13;
}

function emptyByRound(rounds: number): number[][] {
  return Array.from({ length: rounds }, () => []);
}

export function computePlayerStandings(state: LeagueState): PlayerStandingRow[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const roundCount = seasonRoundCount(state);
  const rows = new Map<string, PlayerStandingRow>();

  for (const player of state.players) {
    rows.set(player.id, {
      player,
      teamName: teams.get(player.teamId) ?? "",
      games: 0,
      points: 0,
      pins: 0,
      avg: 0,
      best: 0,
      over200: 0,
      over220: 0,
      over240: 0,
      byRound: emptyByRound(roundCount),
    });
  }

  for (const match of state.matches) {
    const ri = match.round - 1;
    for (const round of match.rounds) {
      for (const game of round.games) {
        const duel = scoreGame(game, state.players);
        const home = rows.get(game.homePlayerId);
        const away = rows.get(game.awayPlayerId);
        const hp = scoredPins(game.homePins, home?.player);
        const ap = scoredPins(game.awayPins, away?.player);
        if (home && hp != null && ri >= 0 && ri < roundCount) {
          home.games += 1;
          home.pins += hp;
          home.best = Math.max(home.best, hp);
          home.byRound[ri].push(hp);
          bumpHighs(home, hp);
          if (duel) home.points += duel.homeTotal;
        }
        if (away && ap != null && ri >= 0 && ri < roundCount) {
          away.games += 1;
          away.pins += ap;
          away.best = Math.max(away.best, ap);
          away.byRound[ri].push(ap);
          bumpHighs(away, ap);
          if (duel) away.points += duel.awayTotal;
        }
      }
    }
  }

  return [...rows.values()]
    .filter((row) => row.games > 0)
    .map((row) => ({ ...row, avg: row.pins / row.games }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.pins !== a.pins) return b.pins - a.pins;
      return a.player.name.localeCompare(b.player.name, "sl");
    });
}

export function playersByAverage(rows: PlayerStandingRow[]): PlayerStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.avg !== a.avg) return b.avg - a.avg;
    if (b.points !== a.points) return b.points - a.points;
    return a.player.name.localeCompare(b.player.name, "sl");
  });
}

export function playersByHighs(
  rows: PlayerStandingRow[],
  key: "over200" | "over220" | "over240",
): PlayerStandingRow[] {
  return rows
    .filter((row) => row[key] > 0)
    .sort((a, b) => {
      if (b[key] !== a[key]) return b[key] - a[key];
      if (b.best !== a.best) return b.best - a.best;
      return a.player.name.localeCompare(b.player.name, "sl");
    });
}

export function teamsByHighs(
  rows: StandingRow[],
  key: "over200" | "over220" | "over240",
): StandingRow[] {
  return rows
    .filter((row) => row[key] > 0)
    .sort((a, b) => {
      if (b[key] !== a[key]) return b[key] - a[key];
      return a.team.name.localeCompare(b.team.name, "sl");
    });
}

export type HighGame = {
  pins: number;
  playerName: string;
  teamName: string;
};

export function topGames(state: LeagueState, limit = 8): HighGame[] {
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));
  const players = new Map(state.players.map((p) => [p.id, p]));
  const games: HighGame[] = [];

  for (const match of state.matches) {
    for (const round of match.rounds) {
      for (const game of round.games) {
        if (game.homePins != null) {
          const player = players.get(game.homePlayerId);
          if (player) {
            games.push({
              pins: scoredPins(game.homePins, player) ?? game.homePins,
              playerName: player.name,
              teamName: teams.get(player.teamId) ?? "",
            });
          }
        }
        if (game.awayPins != null) {
          const player = players.get(game.awayPlayerId);
          if (player) {
            games.push({
              pins: scoredPins(game.awayPins, player) ?? game.awayPins,
              playerName: player.name,
              teamName: teams.get(player.teamId) ?? "",
            });
          }
        }
      }
    }
  }

  return games
    .sort((a, b) => {
      if (b.pins !== a.pins) return b.pins - a.pins;
      return a.playerName.localeCompare(b.playerName, "sl");
    })
    .slice(0, limit);
}

export function lastCompletedRound(state: LeagueState): number {
  let round = 0;
  for (const match of state.matches) {
    if (matchTotals(match, state.players).complete) {
      round = Math.max(round, match.round);
    }
  }
  return round;
}

export function seasonLabel(date = new Date()): string {
  const year = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}/${String(year + 1).slice(-2)}`;
}
