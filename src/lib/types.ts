export type Gender = "M" | "F";

export type Team = {
  id: string;
  name: string;
  captain?: string;
  phone?: string;
  email?: string;
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

export type LeagueState = {
  seasonKey?: "2026-27" | "2025-26";
  seasonTitle?: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  /** Opomba po kolu (pavza, počitnice), npr. iz CSV stolpca opomba. */
  roundNotes?: Record<string, string>;
  /** Oznaka kola (datumi), npr. iz žreba s koledarjem. */
  roundLabels?: Record<string, string>;
};

export type SeasonInfo = {
  id: string;
  label: string;
  archived: boolean;
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
