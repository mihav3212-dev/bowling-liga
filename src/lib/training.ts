import type { LeagueState, Player, TrainingScore, TrainingSession } from "./types";
import { scoredPins } from "./scoring";

export const TRAINING_GAMES = 3;
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

export function padGames(games: (number | null)[] | undefined): (number | null)[] {
  const next = [...(games ?? [])].slice(0, TRAINING_GAMES);
  while (next.length < TRAINING_GAMES) next.push(null);
  return next;
}

export function scoreTotal(score: TrainingScore, player?: Player): number | null {
  const games = padGames(score.games);
  if (games.every((g) => g == null)) return null;
  let sum = 0;
  for (const raw of games) sum += scoredPins(raw, player) ?? 0;
  return sum;
}

export function parseTrainingSessions(value: unknown): TrainingSession[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as TrainingSession;
      if (!item.id || !item.date) return null;
      const scores = Array.isArray(item.scores)
        ? item.scores
            .filter((s) => s && typeof s.playerId === "string")
            .map((s) => ({ playerId: s.playerId, games: padGames(s.games) }))
        : [];
      return { id: String(item.id), date: String(item.date), scores };
    })
    .filter((row): row is TrainingSession => row != null);
}
