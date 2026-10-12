import { describe, expect, it } from "vitest";
import { canEnterPins, canOpenTeamMatch, defaultTeamPerms } from "./access";

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

  it("opens a match when lineup or results are granted", () => {
    expect(canOpenTeamMatch({ id: "t", name: "A" })).toBe(true);
    expect(canOpenTeamMatch({ id: "t", name: "A", perms: { lineup: false } })).toBe(false);
    expect(canOpenTeamMatch({ id: "t", name: "A", perms: { lineup: false, results: true } })).toBe(true);
  });
});
