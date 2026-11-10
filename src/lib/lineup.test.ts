import { describe, expect, it } from "vitest";
import {
  applyLineup,
  applyPlayerSubstitution,
  lineupsRevealed,
  maskMatchLineups,
  playerOnOtherLane,
  preserveSubstitutions,
  repairDuplicateLanePlayers,
  sanitizeLineup,
  substitutedOutIds,
  teamMatchSide,
} from "./lineup";
import { emptyRounds, playerLineupLabel } from "./pairings";
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

  it("reveals both sides after start time, first pins, or liveOnTv", () => {
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

    const forced = sampleMatch({ liveOnTv: true });
    expect(lineupsRevealed(forced)).toBe(true);
    expect(maskMatchLineups(forced, {}).awayStarters).toEqual(forced.awayStarters);
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

  it("keeps mid-match substitutions when lineup is saved again", () => {
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    match.rounds[0].games[0].homePins = 120;
    match.rounds[0].games[0].awayPins = 110;
    const subbed = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    const saved = applyLineup(subbed, "home", subbed.homeStarters, subbed.homeBench);
    expect(saved.rounds[1]?.games[2]?.homePlayerId).toBe("h5");
    expect(saved.rounds[2]?.games.some((g) => g.homePlayerId === "h5")).toBe(true);
    expect(saved.rounds[1]?.games.some((g) => g.homePlayerId === "h1")).toBe(false);
  });

  it("propagates a sub forward and blocks the replaced player from returning", () => {
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    // h1 is on lane index 2 in round 1 (OFFICIAL_4)
    const subbed = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    expect(subbed.rounds[0]?.games.some((g) => g.homePlayerId === "h1")).toBe(true);
    expect(subbed.rounds[1]?.games[2]?.homePlayerId).toBe("h5");
    for (let r = 1; r < 4; r++) {
      expect(subbed.rounds[r]?.games.some((g) => g.homePlayerId === "h1")).toBe(false);
      expect(subbed.rounds[r]?.games.some((g) => g.homePlayerId === "h5")).toBe(true);
    }
    expect(substitutedOutIds(subbed, "home").has("h1")).toBe(true);
    expect(substitutedOutIds(subbed, "home").has("h5")).toBe(false);
    const blocked = applyPlayerSubstitution(subbed, 2, 0, "home", "h1");
    expect(blocked).toBe(subbed);
    expect(blocked.rounds[2]?.games.some((g) => g.homePlayerId === "h1")).toBe(false);
  });

  it("does not let the player who left return, and keeps the substitute selectable", () => {
    const rounds = emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]);
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5", "h6"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      awayBench: ["a5"],
      rounds,
    });
    const subbed = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    // Shranjevanje je A1 spet vpisalo v poznejše kroge.
    subbed.rounds[2].games[1].homePlayerId = "h1";
    subbed.rounds[3].games[3].homePlayerId = "h1";
    const out = substitutedOutIds(subbed, "home");
    expect(out.has("h1")).toBe(true);
    expect(out.has("h5")).toBe(false);
    const healed = preserveSubstitutions(subbed);
    expect(healed.rounds[2]?.games[1]?.homePlayerId).toBe("h5");
    expect(healed.rounds[3]?.games[3]?.homePlayerId).toBe("h5");
    expect(healed.rounds[0]?.games[0]?.homePlayerId).toBe("h1");

    const away = applyPlayerSubstitution(match, 1, 3, "away", "a5");
    expect(substitutedOutIds(away, "away").has("a4")).toBe(true);
    expect(substitutedOutIds(away, "away").has("a5")).toBe(false);
    const back = applyPlayerSubstitution(away, 2, 2, "away", "a4");
    expect(back).toBe(away);
  });

  it("keeps A5 and A6 on that place down the remaining pairs", () => {
    const rounds = emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]);
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5", "h6"],
      rounds,
    });
    // 2. krog, A1 je na tretjem paru (homeSlot 0).
    const asA5 = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    expect(asA5.rounds[0]?.games[0]?.homePlayerId).toBe("h1");
    expect(asA5.rounds[1]?.games[2]?.homePlayerId).toBe("h5");
    expect(asA5.rounds[2]?.games[1]?.homePlayerId).toBe("h5");
    expect(asA5.rounds[3]?.games[3]?.homePlayerId).toBe("h5");
    expect(asA5.rounds[1]?.games[0]?.homePlayerId).toBe("h3");
    expect(asA5.rounds[2]?.games[0]?.homePlayerId).toBe("h2");
    expect(playerLineupLabel("home", "h5", asA5.homeStarters, asA5.homeBench, 0)).toBe("A5");

    // A6 zamenja A2 od 1. kroga naprej (homeSlot 1, prvi par).
    const asA6 = applyPlayerSubstitution(match, 0, 1, "home", "h6");
    expect(asA6.rounds[0]?.games[1]?.homePlayerId).toBe("h6");
    expect(asA6.rounds[1]?.games[3]?.homePlayerId).toBe("h6");
    expect(asA6.rounds[2]?.games[0]?.homePlayerId).toBe("h6");
    expect(asA6.rounds[3]?.games[2]?.homePlayerId).toBe("h6");
    expect(asA6.rounds[0]?.games[0]?.homePlayerId).toBe("h1");
    expect(playerLineupLabel("home", "h6", match.homeStarters, match.homeBench, 1)).toBe("A6");

    const repaired = repairDuplicateLanePlayers(asA5);
    expect(repaired.rounds[2]?.games[1]?.homePlayerId).toBe("h5");
    expect(repaired.rounds[3]?.games[3]?.homePlayerId).toBe("h5");
  });

  it("keeps a later sub when the leaver or the first sub is written back", () => {
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5", "h6"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      awayBench: ["a5", "a6"],
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    const first = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    const second = applyPlayerSubstitution(first, 2, 1, "home", "h6");
    expect(second.rounds[0]?.games[0]?.homePlayerId).toBe("h1");
    expect(second.rounds[1]?.games[2]?.homePlayerId).toBe("h5");
    expect(second.rounds[2]?.games[1]?.homePlayerId).toBe("h6");
    expect(second.rounds[3]?.games[3]?.homePlayerId).toBe("h6");
    expect(second.rounds[2]?.games[0]?.homePlayerId).toBe("h2");

    const out = substitutedOutIds(second, "home");
    expect(out.has("h1")).toBe(true);
    expect(out.has("h5")).toBe(true);
    expect(out.has("h6")).toBe(false);
    expect(applyPlayerSubstitution(second, 3, 3, "home", "h1")).toBe(second);
    expect(applyPlayerSubstitution(second, 3, 3, "home", "h5")).toBe(second);
    expect(applyPlayerSubstitution(second, 3, 0, "home", "h1")).toBe(second);

    second.rounds[3].games[3].homePlayerId = "h1";
    let healed = preserveSubstitutions(second);
    expect(healed.rounds[3]?.games[3]?.homePlayerId).toBe("h6");
    second.rounds[3].games[3].homePlayerId = "h5";
    healed = preserveSubstitutions(second);
    expect(healed.rounds[3]?.games[3]?.homePlayerId).toBe("h6");
    expect(healed.rounds[1]?.games[2]?.homePlayerId).toBe("h5");

    const away = applyPlayerSubstitution(healed, 1, 3, "away", "a5");
    const awayNext = applyPlayerSubstitution(away, 2, 2, "away", "a6");
    expect(substitutedOutIds(awayNext, "away").has("a4")).toBe(true);
    expect(substitutedOutIds(awayNext, "away").has("a5")).toBe(true);
    expect(substitutedOutIds(awayNext, "away").has("a6")).toBe(false);
    expect(substitutedOutIds(awayNext, "home").has("h6")).toBe(false);
    expect(awayNext.rounds[3]?.games[3]?.homePlayerId).toBe("h6");
    expect(applyPlayerSubstitution(awayNext, 3, 3, "away", "a4")).toBe(awayNext);
    expect(applyPlayerSubstitution(awayNext, 3, 3, "away", "a5")).toBe(awayNext);
  });

  it("heals a reverted sub when the lineup is saved before the first pins", () => {
    const match = sampleMatch({
      homeStarters: ["h1", "h2", "h3", "h4"],
      homeBench: ["h5"],
      awayStarters: ["a1", "a2", "a3", "a4"],
      rounds: emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]),
    });
    const subbed = applyPlayerSubstitution(match, 1, 2, "home", "h5");
    subbed.rounds[2].games[1].homePlayerId = "h1";
    subbed.rounds[3].games[3].homePlayerId = "h1";
    const saved = applyLineup(subbed, "home", subbed.homeStarters, subbed.homeBench);
    expect(saved.rounds[1]?.games[2]?.homePlayerId).toBe("h5");
    expect(saved.rounds[2]?.games[1]?.homePlayerId).toBe("h5");
    expect(saved.rounds[3]?.games[3]?.homePlayerId).toBe("h5");
    expect(saved.rounds[0]?.games[0]?.homePlayerId).toBe("h1");
    expect(substitutedOutIds(saved, "home").has("h5")).toBe(false);
    expect(substitutedOutIds(saved, "home").has("h1")).toBe(true);
  });
});
