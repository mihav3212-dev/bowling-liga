import type { Team, TeamPerms } from "./types";

export const TEAM_PERM_KEYS = ["roster", "lineup", "results", "resultsEdit", "season"] as const;

export type TeamPerm = (typeof TEAM_PERM_KEYS)[number];

export type { TeamPerms };

export const TEAM_PERM_LABELS: Record<TeamPerm, string> = {
  roster: "Vnos igralcev v ekipo",
  lineup: "Vnos igralcev na tekmo",
  results: "Vnos rezultatov",
  resultsEdit: "Popravljanje rezultatov",
  season: "Urejanje sezone",
};

export const TEAM_PERM_HINTS: Record<TeamPerm, string> = {
  roster: "Svoj seznam igralcev (imena, +8, BZS).",
  lineup: "Sestava A1–A6 ali B1–B6 na svojih tekmah.",
  results: "Prvi vnos kegljev na svojih tekmah.",
  resultsEdit: "Spreminjanje že vpisanih kegljev.",
  season: "Ekipe, žreb in razpored — kot admin za to sezono.",
};

export function defaultTeamPerms(partial?: Partial<TeamPerms> | null): TeamPerms {
  const next: TeamPerms = {
    roster: false,
    lineup: true,
    results: false,
    resultsEdit: false,
    season: false,
    ...partial,
  };
  if (next.resultsEdit) next.results = true;
  return next;
}

export function teamPerms(team?: Team | null): TeamPerms {
  return defaultTeamPerms(team?.perms);
}

export function canTeam(team: Team | undefined | null, key: TeamPerm): boolean {
  return teamPerms(team)[key];
}

export function canEnterPins(team: Team | undefined | null, existing: number | null): boolean {
  const perms = teamPerms(team);
  if (existing != null) return perms.resultsEdit;
  return perms.results || perms.resultsEdit;
}

export function canOpenTeamMatch(team: Team | undefined | null): boolean {
  const perms = teamPerms(team);
  return perms.lineup || perms.results || perms.resultsEdit || perms.season;
}
