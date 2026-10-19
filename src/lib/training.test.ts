import { describe, expect, it } from "vitest";
import type { LeagueState, Player } from "./types";
import {
  compactGames,
  computePlayerTrainingStats,
  gameColumnCount,
  scoreAverage,
  scoreTotal,
} from "./training";

describe("trening igre", () => {
  it("brez vnosov pokaže eno prazno polje, po vpisu še eno zraven", () => {
    expect(gameColumnCount([])).toBe(1);
    expect(gameColumnCount([{ playerId: "a", games: [] }])).toBe(1);
    expect(gameColumnCount([{ playerId: "a", games: [180] }])).toBe(2);
    expect(gameColumnCount([{ playerId: "a", games: [180, 200] }])).toBe(3);
  });

  it("ob shranjevanju obreže prazna polja na koncu", () => {
    expect(compactGames([180, 200, null, null])).toEqual([180, 200]);
    expect(compactGames([null, 160, null])).toEqual([null, 160]);
    expect(compactGames([null, null])).toEqual([]);
  });

  it("povprečje gre samo čez odigrane igre", () => {
    const score = { playerId: "a", games: [180, 220, null] };
    expect(scoreTotal(score)).toBe(400);
    expect(scoreAverage(score)).toBe(200);
  });
});

describe("computePlayerTrainingStats", () => {
  it("sešteje solo treninge igralca", () => {
    const player: Player = {
      id: "p1",
      teamId: "t1",
      name: "TEST",
      gender: "M",
      bzsMember: false,
    };
    const state: LeagueState = {
      teams: [{ id: "t1", name: "Ekipa" }],
      players: [player],
      matches: [],
      teamTrainings: {
        t1: [
          {
            id: "s1",
            date: "2026-10-10",
            kind: "solo",
            scores: [{ playerId: "p1", games: [180, 200] }],
          },
          {
            id: "s2",
            date: "2026-10-17",
            kind: "solo",
            scores: [{ playerId: "p1", games: [160] }],
          },
        ],
      },
    };
    const stats = computePlayerTrainingStats(state, "p1");
    expect(stats?.games).toBe(3);
    expect(stats?.pins).toBe(540);
    expect(stats?.avg).toBe(180);
    expect(stats?.sessions).toHaveLength(2);
    expect(stats?.sessions[0].date).toBe("2026-10-10");
  });
});
