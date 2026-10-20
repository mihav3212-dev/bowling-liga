import { describe, expect, it } from "vitest";
import type { LeagueState, Player } from "./types";
import {
  compactGames,
  compactTrainings,
  computePlayerTrainingStats,
  gameColumnCount,
  scoreAverage,
  scoreTotal,
  syncLigaTrainingMirrors,
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

  it("vključi admin posamezni trening iz trainingSessions", () => {
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
      teamTrainings: { t1: [] },
      trainingSessions: [
        {
          id: "liga1",
          date: "2026-10-18",
          kind: "solo",
          scores: [{ playerId: "p1", games: [190, 210] }],
        },
      ],
    };
    const stats = computePlayerTrainingStats(state, "p1");
    expect(stats?.games).toBe(2);
    expect(stats?.pins).toBe(400);
    expect(stats?.sessions).toHaveLength(1);
  });
});

describe("syncLigaTrainingMirrors", () => {
  it("prenese solo trening v ekipe udeležencev", () => {
    const state: LeagueState = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
      ],
      players: [
        { id: "p1", teamId: "t1", name: "P1", gender: "M", bzsMember: false },
        { id: "p2", teamId: "t2", name: "P2", gender: "M", bzsMember: false },
      ],
      matches: [],
      trainingSessions: [
        {
          id: "g1",
          date: "2026-10-19",
          kind: "solo",
          scores: [
            { playerId: "p1", games: [180] },
            { playerId: "p2", games: [200] },
          ],
        },
      ],
      teamTrainings: { t1: [], t2: [] },
    };
    const next = syncLigaTrainingMirrors(state);
    expect(next.teamTrainings?.t1).toHaveLength(1);
    expect(next.teamTrainings?.t1?.[0].fromLiga).toBe(true);
    expect(next.teamTrainings?.t1?.[0].scores).toEqual([{ playerId: "p1", games: [180] }]);
    expect(next.teamTrainings?.t2?.[0].scores).toEqual([{ playerId: "p2", games: [200] }]);
  });

  it("compactTrainings sinhronizira zrcaljenja", () => {
    const state: LeagueState = {
      teams: [{ id: "t1", name: "A" }],
      players: [{ id: "p1", teamId: "t1", name: "P1", gender: "M", bzsMember: false }],
      matches: [],
      trainingSessions: [
        {
          id: "g1",
          date: "2026-10-19",
          kind: "solo",
          scores: [{ playerId: "p1", games: [160, null] }],
        },
      ],
    };
    const next = compactTrainings(state);
    expect(next.teamTrainings?.t1?.[0].fromLiga).toBe(true);
    expect(next.teamTrainings?.t1?.[0].scores[0].games).toEqual([160]);
  });
});
