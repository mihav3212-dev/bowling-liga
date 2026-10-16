import { describe, expect, it } from "vitest";
import { cloneTeamsAndPlayers } from "./cloneRoster";
import type { Player, Team } from "./types";

const teams: Team[] = [
  { id: "t1", name: "Vardam", captain: "A", passwordHash: "hash1" },
  { id: "t2", name: "Parma", phone: "040" },
  { id: "t3", name: "Skip" },
];

const players: Player[] = [
  { id: "p1", teamId: "t1", name: "NOVAK", gender: "M", bzsMember: false },
  { id: "p2", teamId: "t2", name: "ŽENSKA", gender: "F", bzsMember: true },
  { id: "p3", teamId: "t3", name: "X", gender: "M", bzsMember: false },
];

describe("cloneTeamsAndPlayers", () => {
  it("copies selected teams and remaps players", () => {
    const next = cloneTeamsAndPlayers(teams, players, ["t1", "t2"], true);
    expect(next.teams).toHaveLength(2);
    expect(next.teams.map((t) => t.name).sort()).toEqual(["Parma", "Vardam"]);
    expect(next.teams[0]?.id).not.toBe("t1");
    expect(next.teams.find((t) => t.name === "Vardam")?.passwordHash).toBe("hash1");
    expect(next.players).toHaveLength(2);
    expect(next.players.every((p) => next.teams.some((t) => t.id === p.teamId))).toBe(true);
    expect(next.players.find((p) => p.name === "ŽENSKA")?.gender).toBe("F");
  });

  it("can skip players", () => {
    const next = cloneTeamsAndPlayers(teams, players, ["t1"], false);
    expect(next.teams).toHaveLength(1);
    expect(next.players).toHaveLength(0);
  });
});
