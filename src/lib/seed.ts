import { uid } from "./ids";
import { SEASON_TEAM_NAMES } from "./fixtures";
import { SEASON_TEAM_NAMES_2025, SEASON_TITLE_2025 } from "./fixtures2025";
import { buildOfficialMatches } from "./schedule";
import type { LeagueState, Team } from "./types";

export function createSeed(): LeagueState {
  const teams: Team[] = SEASON_TEAM_NAMES.map((name) => ({ id: uid("t"), name }));
  return {
    seasonKey: "2026-27",
    seasonTitle: "2026/2027",
    teams,
    players: [],
    matches: buildOfficialMatches(teams),
  };
}

export function createSeed2025(): LeagueState {
  const teams: Team[] = SEASON_TEAM_NAMES_2025.map((name) => ({ id: uid("t"), name }));
  return {
    seasonKey: "2025-26",
    seasonTitle: `${SEASON_TITLE_2025} (test / arhiv)`,
    teams,
    players: [],
    matches: buildOfficialMatches(teams),
  };
}
