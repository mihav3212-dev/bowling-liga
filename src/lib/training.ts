import { emptyRounds } from "./pairings";
import type { LeagueState, Player, TrainingMatch, TrainingScore, TrainingSession } from "./types";
import { scoredPins } from "./scoring";

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
