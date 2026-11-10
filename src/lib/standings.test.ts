import { describe, expect, it } from "vitest";
import {
  bestMatchStandings,
  computePlayerStandings,
  computeStandings,
  keptMatchCount,
  playerRoundCell,
  qualifiedPlayerRows,
  requiredQualifyMatches,
  scheduledTeamRounds,
  shouldSplitPlayerStandings,
  splitPlayerStandingsByQualify,
} from "./standings";
import type { LeagueState, Match, Player, Team } from "./types";

function team(id: string, name = id): Team {
  return { id, name };
}

function player(id: string, teamId: string): Player {
  return { id, teamId, firstName: "", surname: "", name: id, gender: "M", bzsMember: false };
}

/** Polna 4×4 tekma z enakimi keglji na vseh stezah → zmagovalec ima 2:0. */
function sweepMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  homePlayerId: string,
  awayPlayerId: string,
  homePins: number,
  awayPins: number,
  round = 1,
): Match {
  const games = Array.from({ length: 16 }, (_, i) => ({
    homePlayerId,
    awayPlayerId,
    lane: (i % 4) + 1,
    homePins,
    awayPins,
  }));
  const rounds = [0, 1, 2, 3].map((r) => ({
    games: games.slice(r * 4, r * 4 + 4),
  }));
  return {
    id,
    round,
    homeTeamId,
    awayTeamId,
    homeStarters: [homePlayerId, homePlayerId, homePlayerId, homePlayerId],
    awayStarters: [awayPlayerId, awayPlayerId, awayPlayerId, awayPlayerId],
    homeBench: [],
    awayBench: [],
    rounds,
    status: "done",
  };
}

function state(teams: Team[], players: Player[], matches: Match[]): LeagueState {
  return { teams, players, matches };
}

describe("lestvica ekip — razvrstitev", () => {
  it("razvrsti po zmagovalnih točkah", () => {
    const teams = [team("a", "A"), team("b", "B"), team("c", "C")];
    const players = [player("pa", "a"), player("pb", "b"), player("pc", "c")];
    const matches = [
      sweepMatch("m1", "a", "b", "pa", "pb", 150, 100),
      sweepMatch("m2", "a", "c", "pa", "pc", 150, 100, 2),
      sweepMatch("m3", "b", "c", "pb", "pc", 150, 100, 3),
    ];
    const rows = computeStandings(state(teams, players, matches));
    expect(rows.map((r) => r.team.id)).toEqual(["a", "b", "c"]);
    expect(rows.map((r) => r.big)).toEqual([4, 2, 0]);
  });

  it("ob enakih zmagovalnih točkah odloči medsebojno srečanje", () => {
    const teams = [team("a", "A"), team("b", "B"), team("c", "C"), team("d", "D")];
    const players = [
      player("pa", "a"),
      player("pb", "b"),
      player("pc", "c"),
      player("pd", "d"),
    ];
    // A in B imata po 2 točki; A je premagala B, B ima sicer več velikih/kegljev proti D
    const matches = [
      sweepMatch("ab", "a", "b", "pa", "pb", 120, 100), // A 2, B 0
      sweepMatch("ac", "a", "c", "pa", "pc", 100, 150, 2), // C 2, A 0 → A = 2
      sweepMatch("bd", "b", "d", "pb", "pd", 200, 100, 3), // B 2, D 0 → B = 2, več velikih
    ];
    const rows = computeStandings(state(teams, players, matches));
    const a = rows.find((r) => r.team.id === "a")!;
    const b = rows.find((r) => r.team.id === "b")!;
    expect(a.big).toBe(2);
    expect(b.big).toBe(2);
    // B ima več kegljev (in vsaj enako velikih), a A je višje zaradi medsebojnega
    expect(b.pins).toBeGreaterThan(a.pins);
    expect(rows.indexOf(a)).toBeLessThan(rows.indexOf(b));
  });

  it("brez medsebojnega razvrsti po velikih, potem kegljih", () => {
    const teams = [team("a", "A"), team("b", "B"), team("c", "C")];
    const players = [player("pa", "a"), player("pb", "b"), player("pc", "c")];
    // A in B nista igrali; obe zmagata proti C z različnimi razlikami
    const matches = [
      sweepMatch("ac", "a", "c", "pa", "pc", 180, 100),
      sweepMatch("bc", "b", "c", "pb", "pc", 140, 100, 2),
    ];
    const rows = computeStandings(state(teams, players, matches));
    expect(rows[0].team.id).toBe("a");
    expect(rows[1].team.id).toBe("b");
    expect(rows[0].big).toBe(rows[1].big);
    expect(rows[0].velike).toBeGreaterThanOrEqual(rows[1].velike);
  });
});

describe("lestvica igralcev — 70 % tekem", () => {
  it("zahteva ceil(70 %) tekem ekipe", () => {
    expect(requiredQualifyMatches(0)).toBe(0);
    expect(requiredQualifyMatches(10)).toBe(7);
    expect(requiredQualifyMatches(1)).toBe(1);
  });

  it("pred polovico sezone ne loči lestvic", () => {
    const teams = [team("a", "A"), team("b", "B")];
    const players = [player("pa", "a"), player("pb", "b")];
    // 13 krogov v razporedu, zaključena samo 3 → pod 50 %
    const matches = Array.from({ length: 13 }, (_, i) =>
      sweepMatch(`m${i + 1}`, "a", "b", "pa", "pb", 150, 100, i + 1),
    ).map((m, i) => (i < 3 ? m : { ...m, rounds: [], status: "scheduled" as const }));
    const s = state(teams, players, matches);
    expect(shouldSplitPlayerStandings(s)).toBe(false);
    const split = splitPlayerStandingsByQualify(s, computePlayerStandings(s));
    expect(split.split).toBe(false);
    expect(split.rest).toEqual([]);
  });

  it("po polovici sezone loči ≥ 70 % in preostale", () => {
    const teams = [team("a", "A"), team("b", "B")];
    const players = [
      player("pa", "a"),
      player("pa2", "a"),
      player("pb", "b"),
    ];
    // 10 krogov; 5 zaključenih (= 50 %) — pa igra samo v 2, pa2 v 3
    const matches = Array.from({ length: 10 }, (_, i) => {
      const round = i + 1;
      const homePlayer = i < 2 ? "pa" : "pa2";
      const m = sweepMatch(`m${round}`, "a", "b", homePlayer, "pb", 160, 100, round);
      if (i >= 5) return { ...m, rounds: [], status: "scheduled" as const };
      return m;
    });
    const s = state(teams, players, matches);
    expect(shouldSplitPlayerStandings(s)).toBe(true);
    const split = splitPlayerStandingsByQualify(s, computePlayerStandings(s));
    expect(split.split).toBe(true);
    // Ekipa A: 5 tekem → treba 4. pa ima 2 → rest; pa2 ima 3 → rest; pb ima 5 → qualified
    expect(split.qualified.map((r) => r.player.id)).toEqual(["pb"]);
    expect(split.rest.map((r) => r.player.id).sort()).toEqual(["pa", "pa2"]);
  });
});

describe("lestvica igralcev — 60 % najboljših tekem", () => {
  it("obdrži najbližjih 60 % tekem, vsaj eno", () => {
    expect(keptMatchCount(0)).toBe(0);
    expect(keptMatchCount(1)).toBe(1);
    expect(keptMatchCount(2)).toBe(1);
    expect(keptMatchCount(3)).toBe(2);
    expect(keptMatchCount(5)).toBe(3);
    expect(keptMatchCount(10)).toBe(6);
  });

  it("iz povprečja vrže najšibkejšo tekmo", () => {
    const teams = [team("a", "A"), team("b", "B")];
    const players = [player("pa", "a"), player("pb", "b")];
    const pins = [100, 200, 50];
    const matches = pins.map((homePins, i) =>
      sweepMatch(`m${i + 1}`, "a", "b", "pa", "pb", homePins, 80, i + 1),
    );
    const s = state(teams, players, matches);
    const rows = computePlayerStandings(s);
    const qualified = qualifiedPlayerRows(s, rows);
    expect(qualified.map((row) => row.player.id)).toEqual(["pa", "pb"]);
    const best = bestMatchStandings(qualified);
    const pa = best.find((row) => row.player.id === "pa");
    // 3 tekme → ostaneta 2 najboljši (200 in 100), 50 izpade
    expect(pa?.droppedRounds).toEqual([2]);
    expect(pa?.games).toBe(32);
    expect(pa?.pins).toBe(200 * 16 + 100 * 16);
    expect(pa?.avg).toBe((200 * 16 + 100 * 16) / 32);
    expect(best[0].player.id).toBe("pa");
  });
});

describe("lestvica igralcev — kolo brez tekme", () => {
  it("prazno polje, če ekipa v kolu nima tekme", () => {
    const scheduled = scheduledTeamRounds([
      { round: 1, homeTeamId: "a", awayTeamId: "b" },
    ]);
    expect(scheduled.has("1:a")).toBe(true);
    expect(scheduled.has("1:c")).toBe(false);
    expect(playerRoundCell([], false)).toBe("");
    expect(playerRoundCell([], true)).toBe("—");
    expect(playerRoundCell([200, 180], true)).toBe("380");
  });
});
