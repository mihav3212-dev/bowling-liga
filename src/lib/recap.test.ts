import { describe, expect, it } from "vitest";
import {
  computeRoundRecap,
  computeWeekRecap,
  stateForRound,
  topPlaces,
  type RecapLine,
} from "./recap";
import { emptyRounds } from "./pairings";
import type { LeagueState, Match, Player, Team } from "./types";

describe("topPlaces", () => {
  it("obdrži izenačene na 5. mestu", () => {
    const rows: RecapLine[] = [245, 241, 236, 235, 234, 234, 234, 200].map((value, i) => ({
      showRank: false,
      value,
      name: `P${i}`,
    }));
    const ranked = topPlaces(rows);
    expect(ranked.map((r) => r.value)).toEqual([245, 241, 236, 235, 234, 234, 234]);
    expect(ranked.filter((r) => r.showRank).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

function filledMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  homePin: number,
  awayPin: number,
  leagueRound = 1,
): Match {
  const rounds = emptyRounds(["h1", "h2", "h3", "h4"], ["a1", "a2", "a3", "a4"]);
  for (const round of rounds) {
    for (const game of round.games) {
      game.homePins = homePin;
      game.awayPins = awayPin;
    }
  }
  return {
    id,
    round: leagueRound,
    homeTeamId,
    awayTeamId,
    homeStarters: ["h1", "h2", "h3", "h4"],
    awayStarters: ["a1", "a2", "a3", "a4"],
    homeBench: [],
    awayBench: [],
    status: "done",
    rounds,
  };
}

describe("topSingles / topSeries", () => {
  it("vsak igralec največ enkrat — najboljši rezultat", () => {
    const teams: Team[] = [
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ];
    const players: Player[] = ["h1", "h2", "h3", "h4", "a1", "a2", "a3", "a4"].map((id) => ({
      id,
      teamId: id.startsWith("h") ? "t1" : "t2",
      firstName: "",
      surname: "",
      name: id,
      gender: "M",
      bzsMember: false,
    }));
    const m1 = filledMatch("m1", "t1", "t2", 100, 90);
    // h1: ena igra 250, ostale 100 — najboljša posamezna 250; serija 550
    m1.rounds[0]!.games[0]!.homePins = 250;
    const m2 = filledMatch("m2", "t1", "t2", 180, 80);
    // h1 v 2. tekmi: vse 180 → serija 720 (boljša od 550)
    const state: LeagueState = { teams, players, matches: [m1, m2] };

    const { topSingles, topSeries, bestSingle, bestSeries } = computeWeekRecap(state);

    expect(topSingles.filter((r) => r.name === "h1")).toHaveLength(1);
    expect(topSingles.find((r) => r.name === "h1")?.value).toBe(250);
    expect(bestSingle.map((r) => r.name)).toEqual(["h1"]);
    expect(bestSingle[0]?.value).toBe(250);

    // Isti človek, dva playerId — še vedno en vnos z max
    const dupState: LeagueState = {
      ...state,
      players: [
        ...players,
        {
          id: "h1b",
          teamId: "t1",
          firstName: "",
          surname: "",
          name: "h1",
          gender: "M",
          bzsMember: false,
        },
      ],
      matches: [
        m1,
        {
          ...m2,
          id: "m3",
          homeStarters: ["h1b", "h2", "h3", "h4"],
          rounds: m2.rounds.map((round) => ({
            ...round,
            games: round.games.map((g, i) =>
              i === 0 ? { ...g, homePlayerId: "h1b", homePins: 260 } : g,
            ),
          })),
        },
      ],
    };
    const dup = computeWeekRecap(dupState);
    expect(dup.topSingles.filter((r) => r.name === "h1")).toHaveLength(1);
    expect(dup.topSingles.find((r) => r.name === "h1")?.value).toBe(260);

    expect(topSeries.filter((r) => r.name === "h1")).toHaveLength(1);
    expect(topSeries.find((r) => r.name === "h1")?.value).toBe(720);
    // m2: vsi domači 4×180 = 720
    expect(bestSeries.every((r) => r.value === 720)).toBe(true);
    expect(bestSeries.map((r) => r.name).sort()).toEqual(["h1", "h2", "h3", "h4"]);
  });
});

describe("topTeams", () => {
  it("vsaka ekipa največ enkrat (najboljši izid)", () => {
    const teams: Team[] = [
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ];
    const players: Player[] = ["h1", "h2", "h3", "h4", "a1", "a2", "a3", "a4"].map((id) => ({
      id,
      teamId: id.startsWith("h") ? "t1" : "t2",
      firstName: "",
      surname: "",
      name: id,
      gender: "M",
      bzsMember: false,
    }));
    const state: LeagueState = {
      teams,
      players,
      matches: [
        filledMatch("m1", "t1", "t2", 100, 90),
        filledMatch("m2", "t1", "t2", 120, 80),
      ],
    };
    const { topTeams, bestTeam } = computeWeekRecap(state);
    const names = topTeams.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n === "Alpha")).toHaveLength(1);
    // 4 kroga × 4 igre × 120 = 1920
    expect(topTeams.find((row) => row.name === "Alpha")?.value).toBe(1920);
    expect(bestTeam.map((row) => row.name)).toEqual(["Alpha"]);
  });
});

describe("computeRoundRecap", () => {
  it("levo best-* je samo to kolo; season TOP 5 ostane širši", () => {
    const teams: Team[] = [
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ];
    const players: Player[] = ["h1", "h2", "h3", "h4", "a1", "a2", "a3", "a4"].map((id) => ({
      id,
      teamId: id.startsWith("h") ? "t1" : "t2",
      firstName: "",
      surname: "",
      name: id,
      gender: "M",
      bzsMember: false,
    }));
    // Kolo 1: visoki rezultati (ne smejo vplivati na leve highlight-e kola 4)
    const m1 = filledMatch("m1", "t1", "t2", 200, 50, 1);
    m1.rounds[0]!.games[0]!.homePins = 280;
    // Kolo 4: nižji — pravi round highs za levo
    const m4 = filledMatch("m4", "t1", "t2", 110, 100, 4);
    m4.rounds[0]!.games[0]!.homePins = 150;
    const state: LeagueState = { teams, players, matches: [m1, m4] };

    expect(stateForRound(state, 4).matches.map((m) => m.id)).toEqual(["m4"]);

    // Desni TOP 5 na PDF: kumulativa / sezona (view through round)
    const season = computeWeekRecap(state);
    expect(season.bestSingle[0]?.value).toBe(280);
    expect(season.topSingles[0]?.value).toBe(280);
    // h1 serija kolo 1: 280 + 3×200 = 880
    expect(season.bestSeries[0]?.value).toBe(880);
    expect(season.topSeries[0]?.value).toBe(880);
    // Alpha kolo 1: 280 + 15×200 = 3280
    expect(season.bestTeam[0]?.value).toBe(3280);
    expect(season.topTeams[0]?.value).toBe(3280);

    // Levi best-* na PDF: samo kolo 4
    const round4 = computeRoundRecap(state, 4);
    expect(round4.bestSingle[0]?.value).toBe(150);
    expect(round4.bestSingle.map((r) => r.name)).toEqual(["h1"]);
    // serija: 150 + 3×110 = 480
    expect(round4.bestSeries.find((r) => r.name === "h1")?.value).toBe(480);
    // ekipa: 150 + 15×110 = 1800
    expect(round4.bestTeam[0]?.name).toBe("Alpha");
    expect(round4.bestTeam[0]?.value).toBe(1800);

    // Round recap top* se razlikuje od season top* (PDF desno uporabi season)
    expect(round4.topSingles[0]?.value).toBe(150);
    expect(season.topSingles[0]?.value).not.toBe(round4.topSingles[0]?.value);
  });
});
