import { describe, expect, it } from "vitest";
import {
  appendFixtureRows,
  buildDrawMatches,
  buildReturnDraw,
  daysNeededForHalf,
  firstHalfComplete,
  flipMatchHomeAway,
  parseScheduleCsv,
  splitCalendarDates,
} from "./schedule";
import type { LeagueState, Match, Team } from "./types";

describe("parseScheduleCsv", () => {
  it("prebere pavzo samo iz kola in opombe", () => {
    const parsed = parseScheduleCsv(
      "kolo;opomba\n2;28.–29. oktober 2026 — prost teden (liga se ne igra)\n",
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toEqual([
      {
        round: 2,
        home: "",
        away: "",
        note: "28.–29. oktober 2026 — prost teden (liga se ne igra)",
        startsAt: undefined,
      },
    ]);
  });
});

describe("appendFixtureRows", () => {
  it("shrani opombo k kolu", () => {
    const state: LeagueState = { teams: [], players: [], matches: [] };
    const next = appendFixtureRows(state, [
      { round: 2, home: "", away: "", note: "prost teden" },
    ]);
    expect(next.roundNotes).toEqual({ "2": "prost teden" });
    expect(next.matches).toHaveLength(0);
  });
});

describe("žreb s koledarjem", () => {
  const teams: Team[] = ["A", "B", "C", "D"].map((name, i) => ({ id: `t${i}`, name }));
  const dates = ["2026-10-14", "2026-10-21", "2026-10-28"];

  it("4 ekipe: 3 kola, 2 tekmi na kolo, 1 dan na kolo", () => {
    expect(daysNeededForHalf(4)).toBe(3);
  });

  it("1. del zamenja v 2. delu domačina in gosta ter premeša termine", () => {
    const first = buildDrawMatches(teams, dates);
    const state: LeagueState = { teams, players: [], matches: first.matches, roundLabels: first.roundLabels };
    expect(firstHalfComplete(state)).toBe(true);
    const secondDates = ["2027-01-13", "2027-01-20", "2027-01-27"];
    const next = buildReturnDraw(state, secondDates);
    const ret = next.matches.filter((m) => m.round > 3);
    expect(ret).toHaveLength(first.matches.length);
    const original = first.matches[0];
    const counterpart = ret.find(
      (m) => m.homeTeamId === original.awayTeamId && m.awayTeamId === original.homeTeamId,
    );
    expect(counterpart).toBeTruthy();
    expect(counterpart?.startsAt?.startsWith("2027-")).toBe(true);
  });

  it("pon.–pet. v tednu je počitnice in se izpiše po prejšnjem kolu", () => {
    const match = ["2026-10-14", "2026-10-21", "2026-11-04"];
    const holiday = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
    const plan = splitCalendarDates([...match, ...holiday]);
    expect(plan.matchDays).toEqual(match);
    expect(plan.holidayWeeks).toHaveLength(1);
    const drawn = buildDrawMatches(teams, [...match, ...holiday]);
    expect(drawn.roundNotes["2"]).toMatch(/počitnice/);
    expect(drawn.matches).toHaveLength(6);
  });
});

describe("flipMatchHomeAway", () => {
  it("zamenja ekipe, sestavo in keglje, termin pusti", () => {
    const match: Match = {
      id: "m1",
      round: 3,
      homeTeamId: "h",
      awayTeamId: "a",
      startsAt: "2026-11-01T19:00:00",
      homeStarters: ["h1"],
      awayStarters: ["a1"],
      homeBench: ["h2"],
      awayBench: ["a2"],
      status: "scheduled",
      rounds: [
        {
          games: [
            {
              homePlayerId: "h1",
              awayPlayerId: "a1",
              lane: 1,
              homePins: 180,
              awayPins: 150,
            },
          ],
        },
      ],
    };
    const flipped = flipMatchHomeAway(match);
    expect(flipped.homeTeamId).toBe("a");
    expect(flipped.awayTeamId).toBe("h");
    expect(flipped.homeStarters).toEqual(["a1"]);
    expect(flipped.awayStarters).toEqual(["h1"]);
    expect(flipped.homeBench).toEqual(["a2"]);
    expect(flipped.awayBench).toEqual(["h2"]);
    expect(flipped.startsAt).toBe("2026-11-01T19:00:00");
    expect(flipped.round).toBe(3);
    expect(flipped.rounds[0].games[0]).toMatchObject({
      homePlayerId: "a1",
      awayPlayerId: "h1",
      homePins: 150,
      awayPins: 180,
      lane: 1,
    });
  });
});
