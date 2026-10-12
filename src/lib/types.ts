export type Gender = "M" | "F";

export type TeamPerms = {
  roster: boolean;
  lineup: boolean;
  results: boolean;
  resultsEdit: boolean;
  season: boolean;
};

export type Team = {
  id: string;
  name: string;
  captain?: string;
  phone?: string;
  email?: string;
  /** Samo v shrambi; klient dobi hasAccess. */
  passwordHash?: string;
  hasAccess?: boolean;
  perms?: Partial<TeamPerms>;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  gender: Gender;
  bzsMember: boolean;
};

export type MatchStatus = "scheduled" | "done";

export type GameScore = {
  homePlayerId: string;
  awayPlayerId: string;
  lane: number;
  homePins: number | null;
  awayPins: number | null;
};

export type MatchRound = {
  games: GameScore[];
};

export type Match = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  /** ISO začetek (ura in datum iz uradnega razporeda). */
  startsAt?: string;
  homeStarters: string[];
  awayStarters: string[];
  homeBench: string[];
  awayBench: string[];
  rounds: MatchRound[];
  status: MatchStatus;
};

export type TrainingScore = {
  playerId: string;
  games: (number | null)[];
};

export type TrainingKind = "solo" | "match";

export type TrainingMatch = {
  homeTeamId?: string;
  awayTeamId?: string;
  homeName?: string;
  awayName?: string;
  homeStarters: string[];
  awayStarters: string[];
  homeBench: string[];
  awayBench: string[];
  rounds: MatchRound[];
};

export type TrainingSession = {
  id: string;
  /** Koledarski datum YYYY-MM-DD, lokalni. */
  date: string;
  kind?: TrainingKind;
  scores: TrainingScore[];
  match?: TrainingMatch;
};

export type LeagueState = {
  seasonKey?: "2026-27" | "2025-26";
  seasonTitle?: string;
  /** Vidna samo prijavljenim; za vajo vnosa, ne za javnost. */
  training?: boolean;
  teams: Team[];
  players: Player[];
  matches: Match[];
  /** Seje treninga (samo ko je training: true). */
  trainingSessions?: TrainingSession[];
  /** Treningi po ekipi v uradni sezoni. */
  teamTrainings?: Record<string, TrainingSession[]>;
  /** Opomba po kolu (pavza, počitnice), npr. iz CSV stolpca opomba. */
  roundNotes?: Record<string, string>;
  /** Oznaka kola (datumi), npr. iz žreba s koledarjem. */
  roundLabels?: Record<string, string>;
};

export type SeasonInfo = {
  id: string;
  label: string;
  archived: boolean;
  training?: boolean;
  updatedAt?: string;
};

export type DuelResult = {
  homeDuel: number;
  awayDuel: number;
  homeBonus: number;
  awayBonus: number;
  homeTotal: number;
  awayTotal: number;
  homeAdjusted: number;
  awayAdjusted: number;
};

export type MatchTotals = {
  homeSmall: number;
  awaySmall: number;
  /** Velike točke: 2/1/0 po krogu (rumeni seštevek) + 2 za več kegljev. */
  homeBig: number;
  awayBig: number;
  /** TOČKE ekipe za lestvico: zmaga 2, remi 1, poraz 0. */
  homeMatch: number;
  awayMatch: number;
  homePins: number;
  awayPins: number;
  complete: boolean;
  rounds: { homeSmall: number; awaySmall: number; homeBig: number; awayBig: number; homePins: number; awayPins: number; complete: boolean }[];
};
