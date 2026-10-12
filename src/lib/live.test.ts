import { describe, expect, it } from "vitest";
import { MATCH_SLOT_MS, matchesInPlay, nextSlotMatches } from "./live";
import type { Match } from "./types";

function match(id: string, startsAt: string): Match {
  return {
    id,
    round: 1,
    homeTeamId: "h",
    awayTeamId: "a",
    homeStarters: [],
    awayStarters: [],
    homeBench: [],
    awayBench: [],
    rounds: [],
    status: "scheduled",
    startsAt,
  };
}

describe("tekme v živo", () => {
  const first = match("1", "2026-10-14T18:00:00+02:00");
  const second = match("2", "2026-10-14T19:30:00+02:00");
  const all = [first, second, match("3", "2026-10-14T18:00:00+02:00")];

  it("najde tekme v tekočem terminu", () => {
    const now = new Date("2026-10-14T18:20:00+02:00").getTime();
    expect(matchesInPlay(all, now).map((m) => m.id).sort()).toEqual(["1", "3"]);
  });

  it("ob menjavi termina zaključi prejšnji slot", () => {
    const now = new Date("2026-10-14T19:30:00+02:00").getTime();
    expect(matchesInPlay(all, now).map((m) => m.id)).toEqual(["2"]);
  });

  it("pred začetkom pokaže naslednji termin", () => {
    const now = new Date("2026-10-14T17:00:00+02:00").getTime();
    expect(matchesInPlay(all, now)).toEqual([]);
    expect(nextSlotMatches(all, now).map((m) => m.id).sort()).toEqual(["1", "3"]);
  });

  it("slot traja 90 minut", () => {
    expect(MATCH_SLOT_MS).toBe(90 * 60 * 1000);
  });
});
