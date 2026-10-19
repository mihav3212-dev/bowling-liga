import { emptyRounds } from "./pairings";
import type {
  LeagueState,
  Match,
  Player,
  TrainingMatch,
  TrainingScore,
  TrainingSession,
} from "./types";
import { scoredPins } from "./scoring";

/** TrainingMatch → Match (za točkovanje / TV). */
export function trainingAsMatch(id: string, match: TrainingMatch): Match {
  return {
    id,
    round: 1,
    homeTeamId: match.homeTeamId ?? "",
    awayTeamId: match.awayTeamId ?? "",
    homeStarters: match.homeStarters,
    awayStarters: match.awayStarters,
    homeBench: match.homeBench,
    awayBench: match.awayBench,
    rounds: match.rounds,
    status: "scheduled",
  };
}

/** Poišči trening sejo po id (admin global ali teamTrainings). */
export function findTrainingSession(
  state: LeagueState,
  sessionId: string,
): TrainingSession | null {
  const global = state.trainingSessions?.find((s) => s.id === sessionId);
  if (global) return global;
  for (const list of Object.values(state.teamTrainings ?? {})) {
    const hit = list.find((s) => s.id === sessionId);
    if (hit) return hit;
  }
  return null;
}

export const TRAINING_TEAM_ID = "train-pool";

export function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTrainingDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString("sl-SI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function emptyTrainingMatch(homeTeamId?: string, awayTeamId?: string, homeName?: string, awayName?: string): TrainingMatch {
  const blanks = ["", "", "", ""];
  return {
    homeTeamId,
    awayTeamId,
    homeName,
    awayName,
    homeStarters: [...blanks],
    awayStarters: [...blanks],
    homeBench: [],
    awayBench: [],
    rounds: emptyRounds(blanks, blanks),
  };
}

export function trainingMatchTitle(session: TrainingSession, teams: { id: string; name: string }[]): string {
  const match = session.match;
  if (!match) return "Tekma";
  const home = teams.find((t) => t.id === match.homeTeamId)?.name || match.homeName || "Domači";
  const away = teams.find((t) => t.id === match.awayTeamId)?.name || match.awayName || "Gostje";
  return `${home} — ${away}`;
}

export function emptyTrainingState(): LeagueState {
  return {
    seasonTitle: "Trening",
    training: true,
    teams: [{ id: TRAINING_TEAM_ID, name: "Trening" }],
    players: [],
    matches: [],
    trainingSessions: [],
  };
}

export function playerCountLabel(n: number): string {
  if (n === 1) return "1 igralec";
  if (n === 2) return "2 igralca";
  return `${n} igralci`;
}

export function gameColumnCount(scores: TrainingScore[]): number {
  let last = -1;
  for (const row of scores) {
    (row.games ?? []).forEach((pins, i) => {
      if (pins != null) last = Math.max(last, i);
    });
  }
  return last + 2;
}

export function padGames(games: (number | null)[] | undefined, length: number): (number | null)[] {
  const next = [...(games ?? [])];
  while (next.length < length) next.push(null);
  return next;
}

export function compactGames(games: (number | null)[] | undefined): (number | null)[] {
  const next = [...(games ?? [])];
  while (next.length && next[next.length - 1] == null) next.pop();
  return next;
}

export function compactSession(session: TrainingSession): TrainingSession {
  if (session.kind === "match") return session;
  return {
    ...session,
    scores: session.scores.map((row) => ({ ...row, games: compactGames(row.games) })),
  };
}

export function compactTrainings(state: LeagueState): LeagueState {
  const trainingSessions = state.trainingSessions?.map(compactSession);
  const teamTrainings = state.teamTrainings
    ? Object.fromEntries(Object.entries(state.teamTrainings).map(([id, list]) => [id, list.map(compactSession)]))
    : state.teamTrainings;
  return { ...state, trainingSessions, teamTrainings };
}

export function scoreTotal(score: TrainingScore, player?: Player): number | null {
  const games = score.games ?? [];
  if (games.every((g) => g == null)) return null;
  let sum = 0;
  for (const raw of games) sum += scoredPins(raw, player) ?? 0;
  return sum;
}

export function gamesPlayed(score: TrainingScore): number {
  return (score.games ?? []).filter((pins) => pins != null).length;
}

export function scoreAverage(score: TrainingScore, player?: Player): number | null {
  const played = gamesPlayed(score);
  const total = scoreTotal(score, player);
  if (!played || total == null) return null;
  return total / played;
}

export function getTeamSessions(state: LeagueState, teamId?: string | null): TrainingSession[] {
  if (state.training || !teamId) return state.trainingSessions ?? [];
  return state.teamTrainings?.[teamId] ?? [];
}

export type PlayerTrainingSessionRow = {
  sessionId: string;
  date: string;
  kind: "solo" | "match";
  games: number;
  pins: number;
  avg: number;
  best: number;
};

export type PlayerTrainingStats = {
  games: number;
  pins: number;
  avg: number;
  best: number;
  sessions: PlayerTrainingSessionRow[];
};

function adjustedTrainingPins(raw: number | null, player: Player): number | null {
  if (raw == null) return null;
  if (raw === 0) return 0;
  return scoredPins(raw, player);
}

/** Statistika igralca na treningih ekipe (solo + trening tekme). */
export function computePlayerTrainingStats(
  state: LeagueState,
  playerId: string,
): PlayerTrainingStats | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const sessions = getTeamSessions(state, player.teamId);
  const rows: PlayerTrainingSessionRow[] = [];
  let games = 0;
  let pins = 0;
  let best = 0;

  for (const session of sessions) {
    let sGames = 0;
    let sPins = 0;
    let sBest = 0;

    if (session.kind === "match" && session.match) {
      for (const round of session.match.rounds ?? []) {
        for (const game of round.games ?? []) {
          const isHome = game.homePlayerId === playerId;
          const isAway = game.awayPlayerId === playerId;
          if (!isHome && !isAway) continue;
          const value = adjustedTrainingPins(isHome ? game.homePins : game.awayPins, player);
          if (value == null) continue;
          sGames += 1;
          sPins += value;
          sBest = Math.max(sBest, value);
        }
      }
    } else {
      const row = session.scores.find((s) => s.playerId === playerId);
      if (row) {
        for (const raw of row.games ?? []) {
          const value = adjustedTrainingPins(raw, player);
          if (value == null) continue;
          sGames += 1;
          sPins += value;
          sBest = Math.max(sBest, value);
        }
      }
    }

    if (sGames === 0) continue;
    games += sGames;
    pins += sPins;
    best = Math.max(best, sBest);
    rows.push({
      sessionId: session.id,
      date: session.date,
      kind: session.kind === "match" ? "match" : "solo",
      games: sGames,
      pins: sPins,
      avg: sPins / sGames,
      best: sBest,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));

  return {
    games,
    pins,
    avg: games ? pins / games : 0,
    best,
    sessions: rows,
  };
}

export function setTeamSessions(
  state: LeagueState,
  teamId: string | undefined | null,
  sessions: TrainingSession[],
): LeagueState {
  if (state.training || !teamId) return { ...state, trainingSessions: sessions };
  return { ...state, teamTrainings: { ...state.teamTrainings, [teamId]: sessions } };
}

export function parseTrainingSessions(value: unknown): TrainingSession[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sessions: TrainingSession[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as TrainingSession;
    if (!item.id || !item.date) continue;
    const scores = Array.isArray(item.scores)
      ? item.scores
          .filter((s) => s && typeof s.playerId === "string")
          .map((s) => ({
            playerId: s.playerId,
            games: Array.isArray(s.games)
              ? s.games.map((pins) => (typeof pins === "number" ? pins : null))
              : [],
          }))
      : [];
    sessions.push({
      id: String(item.id),
      date: String(item.date),
      kind: item.kind === "match" ? "match" : "solo",
      scores,
      match: item.match,
    });
  }
  return sessions;
}
