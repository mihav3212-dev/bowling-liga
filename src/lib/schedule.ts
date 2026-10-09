import { emptyRounds } from "./pairings";
import { uid } from "./ids";
import { inferSeasonKey, seasonCatalog, teamNamesMatchOfficial } from "./fixtures";
import { teamNamesMatch2025 } from "./fixtures2025";
import type { Match, Team } from "./types";

const BYE = "__bye__";

/** Krožni razpored. Liho število ekip: vsako kolo ena počiva. */
export function roundRobinPairings(teamIds: string[]): { homeId: string; awayId: string }[][] {
  const n = teamIds.length;
  if (n < 2) return [];
  const ids = n % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const rounds: { homeId: string; awayId: string }[][] = [];
  const count = ids.length;

  for (let r = 0; r < count - 1; r++) {
    const pairings: { homeId: string; awayId: string }[] = [];
    for (let i = 0; i < count / 2; i++) {
      const a = ids[i];
      const b = ids[count - 1 - i];
      if (a !== BYE && b !== BYE) {
        if (r % 2 === 0) pairings.push({ homeId: a, awayId: b });
        else pairings.push({ homeId: b, awayId: a });
      }
    }
    rounds.push(pairings);
    const last = ids.pop()!;
    ids.splice(1, 0, last);
  }
  return rounds;
}

function emptyMatch(
  round: number,
  homeTeamId: string,
  awayTeamId: string,
  startsAt?: string,
): Match {
  return {
    id: uid("m"),
    round,
    homeTeamId,
    awayTeamId,
    startsAt,
    homeStarters: ["", "", "", ""],
    awayStarters: ["", "", "", ""],
    homeBench: [],
    awayBench: [],
    rounds: emptyRounds(["", "", "", ""], ["", "", "", ""]),
    status: "scheduled",
  };
}

export function buildOfficialMatches(teams: Team[]): Match[] {
  const byName = new Map(teams.map((t) => [t.name, t.id]));
  const catalog = seasonCatalog(inferSeasonKey({ teams }));
  const matches: Match[] = [];
  for (const round of catalog.rounds) {
    for (const fixture of round.matches) {
      const homeId = byName.get(fixture.home);
      const awayId = byName.get(fixture.away);
      if (!homeId || !awayId) {
        throw new Error(`Manjka ekipa za tekmo ${fixture.home} — ${fixture.away}`);
      }
      matches.push(emptyMatch(round.round, homeId, awayId, fixture.startsAt));
    }
  }
  return matches;
}

export function buildRoundRobinMatches(teams: Team[]): Match[] {
  const rounds = roundRobinPairings(teams.map((t) => t.id));
  const matches: Match[] = [];
  rounds.forEach((pairings, index) => {
    for (const { homeId, awayId } of pairings) {
      matches.push(emptyMatch(index + 1, homeId, awayId));
    }
  });
  return matches;
}

export function buildSeasonMatches(teams: Team[]): Match[] {
  const names = teams.map((t) => t.name);
  if (teamNamesMatchOfficial(names) || teamNamesMatch2025(names)) {
    return buildOfficialMatches(teams);
  }
  return buildRoundRobinMatches(teams);
}

export function byeTeamName(round: number, teams: Team[], matches: Match[]): string | undefined {
  const playing = new Set(
    matches
      .filter((m) => m.round === round)
      .flatMap((m) => [m.homeTeamId, m.awayTeamId]),
  );
  return teams.find((t) => !playing.has(t.id))?.name;
}
