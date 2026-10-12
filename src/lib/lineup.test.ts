import { describe, expect, it } from "vitest";
import { sanitizeLineup, teamMatchSide } from "./lineup";

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
});
