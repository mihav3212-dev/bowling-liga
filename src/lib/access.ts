import type { Match, Team, TeamPerms } from "./types";

/** Ekipe smejo vnašati člane do začetka 2. kola. */
export const ROSTER_LOCK_ROUND = 2;

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
  roster: "Svoj seznam igralcev do začetka 2. kola (potem samo admin).",
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

function startMs(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function matchHasPins(match: Match): boolean {
  return Boolean(
    match.rounds?.some((round) =>
      round.games.some((game) => game.homePins != null || game.awayPins != null),
    ),
  );
}

/** Ali ekipa še sme vnašati/spreminjati člane (do začetka 2. kola). */
export function teamRosterWindowOpen(matches: Match[] | undefined, now = Date.now()): boolean {
  const later = (matches ?? []).filter((match) => match.round >= ROSTER_LOCK_ROUND);
  if (later.length === 0) return true;
  let earliest: number | null = null;
  for (const match of later) {
    const start = startMs(match.startsAt);
    if (start == null) continue;
    if (earliest == null || start < earliest) earliest = start;
  }
  if (earliest != null) return now < earliest;
  return !later.some(matchHasPins);
}
