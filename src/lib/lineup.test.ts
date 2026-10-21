import { describe, expect, it } from "vitest";
import {
  applyLineup,
  lineupsRevealed,
  maskMatchLineups,
  playerOnOtherLane,
  repairDuplicateLanePlayers,
  sanitizeLineup,
  teamMatchSide,
} from "./lineup";
import { emptyRounds } from "./pairings";
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

  it("puts each starter on one lane per round", () => {
    const base = sampleMatch({
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    const next = applyLineup(base, "home", ["h1", "h2", "h3", "h4"], []);
    for (const round of next.rounds) {
      const ids = round.games.map((game) => game.homePlayerId).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(next.rounds[1]?.games[2]?.homePlayerId).toBe("h1");
    expect(next.rounds[2]?.games[2]?.homePlayerId).toBe("h4");
    expect(next.rounds[3]?.games[2]?.homePlayerId).toBe("h2");
  });

  it("moves a duplicated starter back to the labelled lane", () => {
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    match.rounds[1].games[2].homePlayerId = "h3";
    match.rounds[2].games[2].homePlayerId = "h3";
    match.rounds[3].games[2].homePlayerId = "h3";
    const fixed = repairDuplicateLanePlayers(match);
    expect(fixed.rounds[1].games[2].homePlayerId).toBe("h1");
    expect(fixed.rounds[2].games[2].homePlayerId).toBe("h4");
    expect(fixed.rounds[3].games[2].homePlayerId).toBe("h2");
    expect(fixed.rounds[1].games[0].homePlayerId).toBe("h3");
    expect(playerOnOtherLane(fixed.rounds[1].games, "home", "h3", 0)).toBe(false);
  });
});
