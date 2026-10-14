import { describe, expect, it } from "vitest";
import { lineupsRevealed, maskMatchLineups, sanitizeLineup, teamMatchSide } from "./lineup";
import type { Match } from "./types";

function sampleMatch(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    round: 1,
    homeTeamId: "h",
    awayTeamId: "a",
    startsAt: "2099-01-01T18:00:00",
    homeStarters: ["h1", "h2", "h3", "h4"],
    awayStarters: ["a1", "a2", "a3", "a4"],
    homeBench: ["h5"],
    awayBench: ["a5"],
    rounds: [
      {
        games: [
          {
            homePlayerId: "h1",
            awayPlayerId: "a1",
            lane: 1,
            homePins: null,
            awayPins: null,
          },
        ],
      },
    ],
    status: "scheduled",
    ...over,
  };
}

describe("team lineup", () => {
  it("assigns home or away only for that team", () => {
    const match = { homeTeamId: "h", awayTeamId: "a" };
    expect(teamMatchSide(match, "h")).toBe("home");
    expect(teamMatchSide(match, "a")).toBe("away");
    expect(teamMatchSide(match, "x")).toBeNull();
  });

  it("keeps only own roster players and unique slots", () => {
    const allowed = new Set(["p1", "p2", "p3"]);
    const { starters, bench } = sanitizeLineup(["p1", "p2", "p1", "x"], ["p3", "p2", "p4"], allowed);
    expect(starters).toEqual(["p1", "p2", "", ""]);
    expect(bench).toEqual(["p3"]);
  });

  it("hides opponent lineup from the other team until start", () => {
    const match = sampleMatch();
    const forHome = maskMatchLineups(match, { teamId: "h" });
    expect(forHome.homeStarters).toEqual(match.homeStarters);
    expect(forHome.awayStarters).toEqual(["", "", "", ""]);
    expect(forHome.awayBench).toEqual([]);
    expect(forHome.rounds[0]?.games[0]?.awayPlayerId).toBe("");
    expect(forHome.rounds[0]?.games[0]?.homePlayerId).toBe("h1");

    const forAway = maskMatchLineups(match, { teamId: "a" });
    expect(forAway.awayStarters).toEqual(match.awayStarters);
    expect(forAway.homeStarters).toEqual(["", "", "", ""]);
  });

  it("reveals both sides after start time or first pins", () => {
    const match = sampleMatch({ startsAt: "2020-01-01T18:00:00" });
    expect(lineupsRevealed(match)).toBe(true);
    expect(maskMatchLineups(match, { teamId: "h" }).awayStarters).toEqual(match.awayStarters);

    const scored = sampleMatch({
      rounds: [
        {
          games: [
            {
              homePlayerId: "h1",
              awayPlayerId: "a1",
              lane: 1,
              homePins: 100,
              awayPins: null,
            },
          ],
        },
      ],
    });
    expect(lineupsRevealed(scored)).toBe(true);
  });

  it("keeps full lineups for admin", () => {
    const match = sampleMatch();
    expect(maskMatchLineups(match, { admin: true }).awayStarters).toEqual(match.awayStarters);
  });
});
