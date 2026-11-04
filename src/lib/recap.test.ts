import { describe, expect, it } from "vitest";
import { computeWeekRecap, topPlaces, type RecapLine } from "./recap";
import { emptyRounds } from "./pairings";
import type { LeagueState, Match, Player, Team } from "./types";

describe("topPlaces", () => {
  it("obdrži izenačene na 5. mestu", () => {
    const rows: RecapLine[] = [245, 241, 236, 235, 234, 234, 234, 200].map((value, i) => ({
      showRank: false,
      value,
      name: `P${i}`,
    }));
    const ranked = topPlaces(rows);
    expect(ranked.map((r) => r.value)).toEqual([245, 241, 236, 235, 234, 234, 234]);
    expect(ranked.filter((r) => r.showRank).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

function filledMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  homePin: number,
  awayPin: number,
): Match {
  const rounds = emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]);
  for (const round of rounds) {
    for (const game of round.games) {
      game.homePins = homePin;
      game.awayPins = awayPin;
    }
  }
  return {
    id,
    round: 1,
    homeTeamId,
    awayTeamId,
    homeStarters: ["h1", "h2", "h3", "h4"],
    awayStarters: ["a1", "a2", "a3", "a4"],
    homeBench: [],
    awayBench: [],
    status: "done",
    rounds,
  };
}

describe("topTeams", () => {
  it("vsaka ekipa največ enkrat (najboljši izid)", () => {
    const teams: Team[] = [
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ];
    const players: Player[] = ["h1", "h2", "h3", "h4", "a1", "a2", "a3", "a4"].map((id) => ({
      id,
      teamId: id.startsWith("h") ? "t1" : "t2",
      firstName: "",
      surname: "",
      name: id,
      gender: "M",
      bzsMember: false,
    }));
    const state: LeagueState = {
      teams,
      players,
      matches: [
        filledMatch("m1", "t1", "t2", 100, 90),
        filledMatch("m2", "t1", "t2", 120, 80),
      ],
    };
    const { topTeams, bestTeam } = computeWeekRecap(state);
    const names = topTeams.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n === "Alpha")).toHaveLength(1);
    // 4 kroga × 4 igre × 120 = 1920
    expect(topTeams.find((row) => row.name === "Alpha")?.value).toBe(1920);
    expect(bestTeam.map((row) => row.name)).toEqual(["Alpha"]);
  });
});
