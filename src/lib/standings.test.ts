import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";
import type { LeagueState, Match, Player, Team } from "./types";

function team(id: string, name = id): Team {
  return { id, name };
}

function player(id: string, teamId: string): Player {
  return { id, teamId, name: id, gender: "M", bzsMember: false };
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
