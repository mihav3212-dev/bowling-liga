import { describe, expect, it } from "vitest";
import {
  FINAL_SCORE_HOLD_MS,
  buildLiveMatchView,
  pickLiveBoardMatch,
  withFinalScoreHold,
} from "./liveBoard";
import { emptyRounds } from "./pairings";
import type { LeagueState, Match, Player, Team } from "./types";

const teams: Team[] = [
  { id: "h", name: "Vardam" },
  { id: "a", name: "Parma" },
];

const players: Player[] = [
  { id: "p1", teamId: "h", name: "M. Novak", gender: "M", bzsMember: false },
  { id: "p2", teamId: "h", name: "J. Horvat", gender: "M", bzsMember: false },
  { id: "p3", teamId: "h", name: "T. Kralj", gender: "M", bzsMember: false },
  { id: "p4", teamId: "h", name: "S. Breznik", gender: "M", bzsMember: false },
  { id: "p5", teamId: "a", name: "A. Kovač", gender: "M", bzsMember: false },
  { id: "p6", teamId: "a", name: "P. Zupan", gender: "M", bzsMember: false },
  { id: "p7", teamId: "a", name: "L. Vidmar", gender: "M", bzsMember: false },
  { id: "p8", teamId: "a", name: "M. Hribar", gender: "M", bzsMember: false },
];

function matchAt(startsAt: string, patch?: Partial<Match>): Match {
  const home = ["p1", "p2", "p3", "p4"];
  const away = ["p5", "p6", "p7", "p8"];
  return {
    id: "m1",
    round: 3,
    homeTeamId: "h",
    awayTeamId: "a",
    startsAt,
    homeStarters: home,
    awayStarters: away,
    homeBench: [],
    awayBench: [],
    rounds: emptyRounds(home, away),
    status: "scheduled",
    ...patch,
  };
}

describe("pickLiveBoardMatch", () => {
  it("picks match in current slot", () => {
    const start = "2026-10-13T17:00:00.000Z";
    const now = new Date("2026-10-13T17:30:00.000Z").getTime();
    const pick = pickLiveBoardMatch([matchAt(start)], players, now);
    expect(pick.status).toBe("live");
    if (pick.status !== "idle") expect(pick.match.id).toBe("m1");
  });

  it("falls back to next upcoming incomplete match", () => {
    const start = "2026-10-13T19:00:00.000Z";
    const now = new Date("2026-10-13T17:00:00.000Z").getTime();
    const pick = pickLiveBoardMatch([matchAt(start)], players, now);
    expect(pick.status).toBe("next");
  });

  it("is idle when nothing scheduled", () => {
    const pick = pickLiveBoardMatch([], players, Date.now());
    expect(pick.status).toBe("idle");
  });

  it("keeps the incomplete match until it finishes before showing another in the same slot", () => {
    const start = "2026-10-13T17:00:00.000Z";
    const now = new Date("2026-10-13T17:30:00.000Z").getTime();
    const done = matchAt(start, { id: "done", status: "done" });
    // Fill all pins so matchTotals.complete is true.
    done.rounds = done.rounds.map((round) => ({
      games: round.games.map((g) => ({ ...g, homePins: 180, awayPins: 160 })),
    }));
    const open = matchAt(start, { id: "open" });
    const pick = pickLiveBoardMatch([done, open], players, now);
    expect(pick.status).toBe("live");
    if (pick.status !== "idle") expect(pick.match.id).toBe("open");
  });

  it("holds the just-finished match so final points stay on TV before switching", () => {
    const start = "2026-10-13T17:00:00.000Z";
    const now = new Date("2026-10-13T17:30:00.000Z").getTime();
    const done = matchAt(start, { id: "done", status: "done" });
    done.rounds = done.rounds.map((round) => ({
      games: round.games.map((g) => ({ ...g, homePins: 180, awayPins: 160 })),
    }));
    const open = matchAt(start, { id: "open" });
    const base = pickLiveBoardMatch([done, open], players, now);
    expect(base.status).toBe("live");
    if (base.status !== "idle") expect(base.match.id).toBe("open");

    const held = withFinalScoreHold(base, [done, open], players, now, null, "done");
    expect(held.pick.status).toBe("live");
    if (held.pick.status !== "idle") expect(held.pick.match.id).toBe("done");
    expect(held.hold?.matchId).toBe("done");
    expect(held.hold?.until).toBe(now + FINAL_SCORE_HOLD_MS);

    const after = withFinalScoreHold(
      base,
      [done, open],
      players,
      now + FINAL_SCORE_HOLD_MS,
      held.hold,
      "done",
    );
    expect(after.pick.status).toBe("live");
    if (after.pick.status !== "idle") expect(after.pick.match.id).toBe("open");
    expect(after.hold).toBeNull();
  });
});

describe("buildLiveMatchView", () => {
  it("maps team names and empty pins", () => {
    const m = matchAt("2026-10-13T17:00:00.000Z");
    const state: LeagueState = { teams, players, matches: [m] };
    const view = buildLiveMatchView(state, m);
    expect(view.homeName).toBe("Vardam");
    expect(view.awayName).toBe("Parma");
    expect(view.complete).toBe(false);
    expect(view.homeMatch).toBeNull();
    expect(view.roundSummaries).toHaveLength(4);
    expect(view.roundSummaries[0]?.duels[0]?.homeName).toBe("M. Novak");
  });

  it("shows duel pins with +8 / −8 applied", () => {
    const roster: Player[] = [
      { id: "p1", teamId: "h", name: "A. Ženska", gender: "F", bzsMember: false },
      { id: "p2", teamId: "h", name: "B. BZS", gender: "M", bzsMember: true },
      { id: "p3", teamId: "h", name: "C. Navadni", gender: "M", bzsMember: false },
      { id: "p4", teamId: "h", name: "D. Navadni", gender: "M", bzsMember: false },
      { id: "p5", teamId: "a", name: "E. Navadni", gender: "M", bzsMember: false },
      { id: "p6", teamId: "a", name: "F. Navadni", gender: "M", bzsMember: false },
      { id: "p7", teamId: "a", name: "G. Navadni", gender: "M", bzsMember: false },
      { id: "p8", teamId: "a", name: "H. Navadni", gender: "M", bzsMember: false },
    ];
    const m = matchAt("2026-10-13T17:00:00.000Z");
    m.rounds[0]!.games[0] = {
      ...m.rounds[0]!.games[0]!,
      homePlayerId: "p1",
      awayPlayerId: "p5",
      homePins: 180,
      awayPins: 180,
    };
    m.rounds[0]!.games[1] = {
      ...m.rounds[0]!.games[1]!,
      homePlayerId: "p2",
      awayPlayerId: "p6",
      homePins: 180,
      awayPins: 180,
    };
    const view = buildLiveMatchView({ teams, players: roster, matches: [m] }, m);
    const d0 = view.roundSummaries[0]?.duels[0];
    const d1 = view.roundSummaries[0]?.duels[1];
    expect(d0?.homePins).toBe(188); // +8
    expect(d0?.awayPins).toBe(180);
    expect(d1?.homePins).toBe(172); // −8
    expect(d1?.awayPins).toBe(180);
  });
});
