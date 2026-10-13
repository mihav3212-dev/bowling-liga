import { formatMatchWhen } from "./labels";
import { matchesInPlay, nextSlotMatches } from "./live";
import { matchTotals, playerById } from "./scoring";
import { pairingTemplate, slotLabel } from "./pairings";
import type { LeagueState, Match, Player } from "./types";

export type LiveDuelRow = {
  lane: number;
  homeName: string;
  awayName: string;
  homePins: number | null;
  awayPins: number | null;
};

export type LiveRoundSummary = {
  round: number;
  homeSmall: number | null;
  awaySmall: number | null;
  homePins: number | null;
  awayPins: number | null;
  duels: LiveDuelRow[];
};

export type LiveMatchView = {
  complete: boolean;
  round: number;
  homeName: string;
  awayName: string;
  homeMatch: number | null;
  awayMatch: number | null;
  homeBig: number;
  awayBig: number;
  homeSmall: number;
  awaySmall: number;
  homePins: number;
  awayPins: number;
  roundSummaries: LiveRoundSummary[];
  startsAtLabel: string;
};

export type LiveBoardPick =
  | { status: "live" | "next"; match: Match; siblings: number; index: number }
  | { status: "idle" };

const ROTATE_MS = 20_000;

function nameFor(players: Player[], id: string, side: "home" | "away", slot: number): string {
  const player = id ? playerById(players, id) : undefined;
  return player?.name || slotLabel(side, slot);
}

/** Tekme v trenutnem terminu (tudi že končane), sicer naslednje, sicer idle. */
export function pickLiveBoardMatch(matches: Match[], players: Player[], now: number): LiveBoardPick {
  const inSlot = matchesInPlay(matches, now);
  if (inSlot.length > 0) {
    const index = inSlot.length === 1 ? 0 : Math.floor(now / ROTATE_MS) % inSlot.length;
    return { status: "live", match: inSlot[index]!, siblings: inSlot.length, index };
  }

  const open = matches.filter((m) => !matchTotals(m, players).complete);
  const upcoming = nextSlotMatches(open, now);
  if (upcoming.length > 0) {
    const index = upcoming.length === 1 ? 0 : Math.floor(now / ROTATE_MS) % upcoming.length;
    return { status: "next", match: upcoming[index]!, siblings: upcoming.length, index };
  }

  return { status: "idle" };
}

export function buildLiveMatchView(state: LeagueState, match: Match): LiveMatchView {
  const home = state.teams.find((t) => t.id === match.homeTeamId);
  const away = state.teams.find((t) => t.id === match.awayTeamId);
  const totals = matchTotals(match, state.players);
  const rounds = match.rounds ?? [];

  const templates = pairingTemplate();
  const roundSummaries: LiveRoundSummary[] = rounds.map((round, ri) => {
    const rt = totals.rounds[ri];
    const duels: LiveDuelRow[] = (round.games ?? []).map((game, gi) => {
      const pair = templates[ri]?.[gi];
      return {
        lane: game.lane || pair?.lane || gi + 1,
        homeName: nameFor(state.players, game.homePlayerId, "home", pair?.homeSlot ?? gi),
        awayName: nameFor(state.players, game.awayPlayerId, "away", pair?.awaySlot ?? gi),
        homePins: game.homePins,
        awayPins: game.awayPins,
      };
    });
    const hasPins = duels.some((d) => d.homePins != null || d.awayPins != null);
    return {
      round: ri + 1,
      homeSmall: hasPins ? (rt?.homeSmall ?? 0) : null,
      awaySmall: hasPins ? (rt?.awaySmall ?? 0) : null,
      homePins: hasPins ? (rt?.homePins ?? 0) : null,
      awayPins: hasPins ? (rt?.awayPins ?? 0) : null,
      duels,
    };
  });

  while (roundSummaries.length < 4) {
    const n = roundSummaries.length + 1;
    roundSummaries.push({
      round: n,
      homeSmall: null,
      awaySmall: null,
      homePins: null,
      awayPins: null,
      duels: [1, 2, 3, 4].map((lane) => ({
        lane,
        homeName: slotLabel("home", lane - 1),
        awayName: slotLabel("away", lane - 1),
        homePins: null,
        awayPins: null,
      })),
    });
  }

  return {
    complete: totals.complete,
    round: match.round,
    homeName: home?.name ?? "Domači",
    awayName: away?.name ?? "Gostje",
    homeMatch: totals.complete ? totals.homeMatch : null,
    awayMatch: totals.complete ? totals.awayMatch : null,
    homeBig: totals.homeBig,
    awayBig: totals.awayBig,
    homeSmall: totals.homeSmall,
    awaySmall: totals.awaySmall,
    homePins: totals.homePins,
    awayPins: totals.awayPins,
    roundSummaries,
    startsAtLabel: formatMatchWhen(match.startsAt) || "—",
  };
}
