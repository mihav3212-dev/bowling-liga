import { describe, expect, it } from "vitest";
import { OFFICIAL_ROUNDS, SEASON_TEAM_NAMES } from "./fixtures";
import { ROUNDS_2025, SEASON_TEAM_NAMES_2025 } from "./fixtures2025";
import { createSeed, createSeed2025 } from "./seed";
import { pairingTemplate } from "./pairings";
import { roundRobinPairings } from "./schedule";
import { adjustedPins, bonusPoints, lineupLocked, matchTotals, scoreDuel } from "./scoring";
import { computePlayerStandings, topGames } from "./standings";
import type { LeagueState, Match, Player } from "./types";

function player(over: Partial<Player> & { id: string }): Player {
  return {
    teamId: "t",
    name: over.id,
    gender: "M",
    bzsMember: false,
    ...over,
  };
}

describe("zaklep sestave", () => {
  it("zaklene po prvem vnosu kegljev v 1. krogu", () => {
    const empty = [{ games: [{ homePlayerId: "h", awayPlayerId: "a", lane: 1, homePins: null, awayPins: null }] }];
    const scored = [{ games: [{ homePlayerId: "h", awayPlayerId: "a", lane: 1, homePins: 180, awayPins: null }] }];
    expect(lineupLocked(empty)).toBe(false);
    expect(lineupLocked(scored)).toBe(true);
  });
});

describe("pribitki in odbitki", () => {
  it("ženske +8, član BZS −8", () => {
    const woman = player({ id: "w", gender: "F" });
    const bzs = player({ id: "b", bzsMember: true });
    const both = player({ id: "x", gender: "F", bzsMember: true });
    expect(adjustedPins(200, woman)).toBe(208);
    expect(adjustedPins(200, bzs)).toBe(192);
    expect(adjustedPins(200, both)).toBe(200);
  });

  it("pribitek nad 220 in 240", () => {
    expect(bonusPoints(220)).toBe(0);
    expect(bonusPoints(221)).toBe(1);
    expect(bonusPoints(240)).toBe(1);
    expect(bonusPoints(241)).toBe(2);
  });
});

describe("dvoboj", () => {
  const a = player({ id: "a" });
  const b = player({ id: "b" });

  it("zmaga 2:0, remi 1:1", () => {
    expect(scoreDuel(180, 170, a, b).homeDuel).toBe(2);
    expect(scoreDuel(180, 170, a, b).awayDuel).toBe(0);
    expect(scoreDuel(180, 180, a, b)).toMatchObject({ homeDuel: 1, awayDuel: 1 });
  });

  it("seštevek kegljev šteje +8 pri ženskah", () => {
    const home = player({ id: "h", teamId: "H", gender: "F" });
    const away = player({ id: "a", teamId: "A" });
    const games = Array.from({ length: 16 }, (_, i) => ({
      homePlayerId: "h",
      awayPlayerId: "a",
      lane: (i % 4) + 1,
      homePins: 119,
      awayPins: 110,
    }));
    const match: Match = {
      id: "m",
      round: 1,
      homeTeamId: "H",
      awayTeamId: "A",
      homeStarters: ["h"],
      awayStarters: ["a"],
      homeBench: [],
      awayBench: [],
      rounds: [0, 1, 2, 3].map((r) => ({ games: games.slice(r * 4, r * 4 + 4) })),
      status: "done",
    };
    const totals = matchTotals(match, [home, away]);
    expect(totals.homePins).toBe(16 * 127);
    expect(totals.awayPins).toBe(16 * 110);
  });

  it("ženska zmaga zaradi pribitka in dobi točko za 221", () => {
    const w = player({ id: "w", gender: "F" });
    const m = player({ id: "m" });
    const r = scoreDuel(213, 214, w, m);
    expect(r.homeAdjusted).toBe(221);
    expect(r.homeDuel).toBe(2);
    expect(r.homeBonus).toBe(1);
    expect(r.homeTotal).toBe(3);
  });
});

describe("velike točke", () => {
  const home = player({ id: "h", teamId: "H" });
  const away = player({ id: "a", teamId: "A" });

  function fakeMatch(homeSmallGames: number[], awaySmallGames: number[]): Match {
    const games = homeSmallGames.map((hp, i) => ({
      homePlayerId: "h",
      awayPlayerId: "a",
      lane: (i % 4) + 1,
      homePins: hp,
      awayPins: awaySmallGames[i],
    }));
    const rounds = [0, 1, 2, 3].map((r) => ({
      games: games.slice(r * 4, r * 4 + 4),
    }));
    return {
      id: "m",
      round: 1,
      homeTeamId: "H",
      awayTeamId: "A",
      homeStarters: ["h", "h", "h", "h"],
      awayStarters: ["a", "a", "a", "a"],
      homeBench: [],
      awayBench: [],
      rounds,
      status: "done",
    };
  }

  it("krog 2 veliki za več T, plus 2 za več kegljev, TOČKE 2:0", () => {
    const homePins = Array(16).fill(150);
    const awayPins = Array(16).fill(100);
    const totals = matchTotals(fakeMatch(homePins, awayPins), [home, away]);
    expect(totals.homeSmall).toBe(32);
    expect(totals.awaySmall).toBe(0);
    expect(totals.homeBig).toBe(10);
    expect(totals.awayBig).toBe(0);
    expect(totals.homeMatch).toBe(2);
    expect(totals.awayMatch).toBe(0);
  });

  it("izenačene velike = TOČKE 1:1", () => {
    const homePins = [...Array(8).fill(150), ...Array(8).fill(100)];
    const awayPins = [...Array(8).fill(100), ...Array(8).fill(150)];
    const totals = matchTotals(fakeMatch(homePins, awayPins), [home, away]);
    expect(totals.homeSmall).toBe(totals.awaySmall);
    expect(totals.homeBig).toBe(totals.awayBig);
    expect(totals.homeMatch).toBe(1);
    expect(totals.awayMatch).toBe(1);
  });

  it("Vardam–Parma: 8:2 velike in 2:0 TOČKE", () => {
    const homePins = [
      179, 137, 173, 158, 180, 119, 146, 139, 197, 159, 160, 151, 125, 189, 145, 182,
    ];
    const awayPins = [
      106, 144, 148, 180, 117, 147, 127, 116, 128, 145, 126, 160, 155, 150, 158, 125,
    ];
    const totals = matchTotals(fakeMatch(homePins, awayPins), [home, away]);
    expect(totals.homeSmall).toBe(20);
    expect(totals.awaySmall).toBe(12);
    expect(totals.homePins).toBe(2539);
    expect(totals.awayPins).toBe(2232);
    expect(totals.homeBig).toBe(8);
    expect(totals.awayBig).toBe(2);
    expect(totals.homeMatch).toBe(2);
    expect(totals.awayMatch).toBe(0);
  });
});

describe("paritve in razpored", () => {
  it("vsak z vsakim, 4 različne steze", () => {
    const rounds = pairingTemplate();
    expect(rounds).toHaveLength(4);
    const home0 = rounds.map((r) => r.find((g) => g.homeSlot === 0)!);
    expect(new Set(home0.map((g) => g.awaySlot)).size).toBe(4);
    expect(new Set(home0.map((g) => g.lane)).size).toBe(4);
  });

  it("13 ekip = 13 kol × 6 tekem, vsaka enkrat počiva", () => {
    const ids = Array.from({ length: 13 }, (_, i) => `t${i}`);
    const rounds = roundRobinPairings(ids);
    expect(rounds).toHaveLength(13);
    expect(rounds.every((r) => r.length === 6)).toBe(true);
    const pairs = new Set(
      rounds.flatMap((r) => r.map((p) => [p.homeId, p.awayId].sort().join("-"))),
    );
    expect(pairs.size).toBe(78);
    const played = new Map<string, number>();
    for (const id of ids) played.set(id, 0);
    for (const round of rounds) {
      const inRound = new Set<string>();
      for (const p of round) {
        inRound.add(p.homeId);
        inRound.add(p.awayId);
        played.set(p.homeId, (played.get(p.homeId) ?? 0) + 1);
        played.set(p.awayId, (played.get(p.awayId) ?? 0) + 1);
      }
      expect(ids.filter((id) => !inRound.has(id))).toHaveLength(1);
    }
    expect([...played.values()].every((n) => n === 12)).toBe(true);
  });
});

describe("uradni razpored 2026/2027", () => {
  it("13 ekip, 78 različnih parov, vsaka 12 tekem in enkrat počiva", () => {
    const state = createSeed();
    expect(state.teams.map((t) => t.name)).toEqual([...SEASON_TEAM_NAMES]);
    expect(state.matches).toHaveLength(78);
    expect(state.players).toHaveLength(0);
    const pairs = new Set(
      state.matches.map((m) => [m.homeTeamId, m.awayTeamId].sort().join("-")),
    );
    expect(pairs.size).toBe(78);
    for (const round of OFFICIAL_ROUNDS) {
      const games = state.matches.filter((m) => m.round === round.round);
      expect(games).toHaveLength(6);
      expect(games.every((m) => m.startsAt)).toBe(true);
      const playing = new Set(games.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
      const bye = state.teams.find((t) => !playing.has(t.id));
      expect(bye?.name).toBe(round.bye);
    }
  });
});

describe("uradni razpored 2025/2026", () => {
  it("12 ekip, 22 krogov, 132 tekem, vsaka ekipa 22 tekem", () => {
    const state = createSeed2025();
    expect(state.teams.map((t) => t.name)).toEqual([...SEASON_TEAM_NAMES_2025]);
    expect(state.matches).toHaveLength(132);
    const pairs = new Set(
      state.matches.map((m) => [m.homeTeamId, m.awayTeamId].sort().join("-")),
    );
    expect(pairs.size).toBe(66);
    expect(ROUNDS_2025).toHaveLength(22);
    for (const round of ROUNDS_2025) {
      const games = state.matches.filter((m) => m.round === round.round);
      expect(games).toHaveLength(6);
      expect(games.every((m) => m.startsAt)).toBe(true);
      const playing = new Set(games.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
      expect(playing.size).toBe(12);
    }
  });
});

describe("lestvica igralcev", () => {
  it("sešteje točke zmagovalca dvoboja", () => {
    const home = player({ id: "h", teamId: "H", name: "Ana" });
    const away = player({ id: "a", teamId: "A", name: "Bor" });
    const state: LeagueState = {
      teams: [
        { id: "H", name: "Home" },
        { id: "A", name: "Away" },
      ],
      players: [home, away],
      matches: [
        {
          id: "m",
          round: 1,
          homeTeamId: "H",
          awayTeamId: "A",
          homeStarters: ["h"],
          awayStarters: ["a"],
          homeBench: [],
          awayBench: [],
          status: "scheduled",
          rounds: [
            {
              games: [
                {
                  homePlayerId: "h",
                  awayPlayerId: "a",
                  lane: 1,
                  homePins: 200,
                  awayPins: 150,
                },
              ],
            },
          ],
        },
      ],
    };
    const rows = computePlayerStandings(state);
    expect(rows[0].player.id).toBe("h");
    expect(rows[0].points).toBe(2);
    expect(rows[0].over200).toBe(1);
    expect(rows[0].over220).toBe(0);
    expect(rows[0].byRound[0]).toEqual([200]);
    expect(rows[1].points).toBe(0);
    expect(rows[1].byRound[0]).toEqual([150]);
    expect(topGames(state, 2).map((g) => g.pins)).toEqual([200, 150]);
    expect(topGames({ ...state, matches: [] }, 2)).toEqual([]);
  });
});
