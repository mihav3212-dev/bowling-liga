import { describe, expect, it } from "vitest";
import { canEnterPins, canOpenTeamMatch, defaultTeamPerms, teamRosterWindowOpen } from "./access";

describe("team permissions", () => {
  it("turns on results when results can be edited", () => {
    expect(defaultTeamPerms({ resultsEdit: true }).results).toBe(true);
    expect(defaultTeamPerms().lineup).toBe(true);
  });

  it("allows empty pins with results and filled pins only with edit", () => {
    const enter = { lineup: false, roster: false, results: true, resultsEdit: false, season: false };
    const fix = { ...enter, resultsEdit: true };
    expect(canEnterPins({ id: "t", name: "A", perms: enter }, null)).toBe(true);
    expect(canEnterPins({ id: "t", name: "A", perms: enter }, 180)).toBe(false);
    expect(canEnterPins({ id: "t", name: "A", perms: fix }, 180)).toBe(true);
  });

  it("closes team roster entry when round 2 starts", () => {
    const start = "2026-10-21T18:00:00+02:00";
    const matches = [
      {
        id: "m",
        round: 2,
        startsAt: start,
        homeTeamId: "h",
        awayTeamId: "a",
        homeStarters: [],
        awayStarters: [],
        homeBench: [],
        awayBench: [],
        rounds: [],
        status: "scheduled" as const,
      },
    ];
    expect(teamRosterWindowOpen([], Date.parse("2026-10-14T18:00:00+02:00"))).toBe(true);
    expect(teamRosterWindowOpen(matches, Date.parse("2026-10-21T17:00:00+02:00"))).toBe(true);
    expect(teamRosterWindowOpen(matches, Date.parse("2026-10-21T18:00:00+02:00"))).toBe(false);
  });

  it("opens a match when lineup or results are granted", () => {
    expect(canOpenTeamMatch({ id: "t", name: "A" })).toBe(true);
    expect(canOpenTeamMatch({ id: "t", name: "A", perms: { lineup: false } })).toBe(false);
    expect(canOpenTeamMatch({ id: "t", name: "A", perms: { lineup: false, results: true } })).toBe(true);
  });
});
