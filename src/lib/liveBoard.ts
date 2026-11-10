import { formatMatchWhen } from "./labels";
import { matchesInPlay } from "./live";
import { normalizePlayer, playerDisplayName } from "./playerName";
import { matchTotals, playerById, scoreGame, scoredPins } from "./scoring";
import { pairingTemplate, slotLabel } from "./pairings";
import type { LeagueState, Match, Player } from "./types";

/** Na TV: končni keglji s +8/−8; odsotnost (0) ostane 0. */
function displayPins(raw: number | null, playerId: string, players: Player[]): number | null {
  if (raw == null) return null;
  if (raw === 0) return 0;
  return scoredPins(raw, playerById(players, playerId));
}

export type LiveDuelRow = {
  lane: number;
  homeName: string;
  awayName: string;
  homeFirstName?: string;
  homeSurname?: string;
  awayFirstName?: string;
  awaySurname?: string;
  homePins: number | null;
  awayPins: number | null;
  /** Male točke iz tega dvoboja (duel + bonus). */
  homeSmall: number | null;
  awaySmall: number | null;
};

export type LiveRoundSummary = {
  round: number;
  homeSmall: number | null;
  awaySmall: number | null;
  homeBig: number | null;
  awayBig: number | null;
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

function personFor(
  players: Player[],
  id: string,
  side: "home" | "away",
  slot: number,
): { name: string; firstName: string; surname: string } {
  const player = id ? playerById(players, id) : undefined;
  if (!player) {
    const label = slotLabel(side, slot);
    return { name: label, firstName: label, surname: "" };
  }
  const n = normalizePlayer(player);
  return {
    name: playerDisplayName(n),
    firstName: n.firstName,
    surname: n.surname,
  };
}

/** Koliko časa po zapolnitvi vseh kegljev še držimo TV na »Končne točke«, preden preklopimo. */
export const FINAL_SCORE_HOLD_MS = 2 * 60 * 1000;

export type LiveBoardHold = { matchId: string; until: number };

/** Admin je vklopil »V živo na TV« — ima prednost pred razporedom. */
export function forcedLiveMatches(matches: Match[], players: Player[]): Match[] {
  return matches.filter((m) => m.liveOnTv && !matchTotals(m, players).complete);
}

function startedAtMs(match: Match): number | null {
  if (!match.startsAt) return null;
  const t = new Date(match.startsAt).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Zadnja tekma, ki je že začela. Nedokončana ima prednost pred končanim pregledom. */
function lastStartedMatch(matches: Match[], players: Player[], now: number): Match | null {
  const started = matches.filter((match) => {
    const t = startedAtMs(match);
    return t != null && t <= now;
  });
  if (started.length === 0) return null;
  const open = started.filter((match) => !matchTotals(match, players).complete);
  const pool = open.length > 0 ? open : started;
  return [...pool].sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""))[0] ?? null;
}

/**
 * Tekme v trenutnem terminu: najprej admin »V živo na TV«, potem nedokončana v terminu,
 * sicer prva v terminu. Pred naslednjim terminom ostane pregled zadnje tekme, ne prazna naslednja.
 */
export function pickLiveBoardMatch(matches: Match[], players: Player[], now: number): LiveBoardPick {
  const forced = forcedLiveMatches(matches, players);
  if (forced.length > 0) {
    return { status: "live", match: forced[0]!, siblings: 1, index: 0 };
  }

  const inSlot = matchesInPlay(matches, now);
  if (inSlot.length > 0) {
    const openInSlot = inSlot.filter((m) => !matchTotals(m, players).complete);
    const match = openInSlot[0] ?? inSlot[0]!;
    return { status: "live", match, siblings: 1, index: 0 };
  }

  const last = lastStartedMatch(matches, players, now);
  if (last) return { status: "live", match: last, siblings: 1, index: 0 };

  return { status: "idle" };
}

/**
 * Ko se tekma, ki jo TV trenutno kaže, zapolni (vsi keglji), je `complete` — a še zadržimo
 * prikaz končnih točk, preden gre na drugo tekmo v istem terminu.
 */
export function withFinalScoreHold(
  pick: LiveBoardPick,
  matches: Match[],
  players: Player[],
  now: number,
  hold: LiveBoardHold | null,
  previouslyShownId: string | null,
): { pick: LiveBoardPick; hold: LiveBoardHold | null } {
  if (hold && now < hold.until) {
    const held = matches.find((m) => m.id === hold.matchId);
    if (held && matchTotals(held, players).complete) {
      return {
        pick: { status: "live", match: held, siblings: 1, index: 0 },
        hold,
      };
    }
  }

  // Potekel hold za isto tekmo ne zaženemo znova (sicer bi ostali na končnih točkah).
  const expiredSame = Boolean(hold && now >= hold.until && hold.matchId === previouslyShownId);

  if (previouslyShownId && !expiredSame) {
    const prev = matches.find((m) => m.id === previouslyShownId);
    if (prev && matchTotals(prev, players).complete) {
      const leaving = pick.status === "idle" || pick.match.id !== previouslyShownId;
      if (leaving) {
        const nextIsOn =
          pick.status !== "idle" &&
          (pick.match.liveOnTv === true ||
            (prev.startsAt != null &&
              pick.match.startsAt != null &&
              pick.match.startsAt !== prev.startsAt));
        // Naslednji termin ali ročni vklop gre takoj noter. V istem terminu še malo držimo končne točke.
        if (!nextIsOn) {
          const nextHold = { matchId: previouslyShownId, until: now + FINAL_SCORE_HOLD_MS };
          return {
            pick: { status: "live", match: prev, siblings: 1, index: 0 },
            hold: nextHold,
          };
        }
      }
    }
  }

  return { pick, hold: null };
}

export function buildLiveMatchView(
  state: LeagueState,
  match: Match,
  labels?: { homeName?: string; awayName?: string },
): LiveMatchView {
  const home = state.teams.find((t) => t.id === match.homeTeamId);
  const away = state.teams.find((t) => t.id === match.awayTeamId);
  const totals = matchTotals(match, state.players);
  const rounds = match.rounds ?? [];
  /** Po strukturi krogov (uradna 4, trening lahko 2–3), ne po nepopolni sestavi. */
  const size = Math.max(2, Math.min(4, rounds[0]?.games?.length || 4));

  const templates = pairingTemplate(size);
  const roundSummaries: LiveRoundSummary[] = rounds.map((round, ri) => {
    const rt = totals.rounds[ri];
    const duels: LiveDuelRow[] = (round.games ?? [])
      .map((game, gi) => {
        const pair = templates[ri]?.[gi];
        const scored = scoreGame(game, state.players);
        const home = personFor(state.players, game.homePlayerId, "home", pair?.homeSlot ?? gi);
        const away = personFor(state.players, game.awayPlayerId, "away", pair?.awaySlot ?? gi);
        return {
          lane: game.lane || pair?.lane || gi + 1,
          homeName: home.name,
          awayName: away.name,
          homeFirstName: home.firstName,
          homeSurname: home.surname,
          awayFirstName: away.firstName,
          awaySurname: away.surname,
          homePins: displayPins(game.homePins, game.homePlayerId, state.players),
          awayPins: displayPins(game.awayPins, game.awayPlayerId, state.players),
          homeSmall: scored?.homeTotal ?? null,
          awaySmall: scored?.awayTotal ?? null,
          active: Boolean(game.homePlayerId && game.awayPlayerId),
        };
      })
      .filter((d) => d.active || d.homePins != null || d.awayPins != null)
      .map(({ active: _a, ...row }) => row);
    const hasPins = duels.some((d) => d.homePins != null || d.awayPins != null);
    const roundDone = Boolean(rt?.complete);
    return {
      round: ri + 1,
      homeSmall: hasPins ? (rt?.homeSmall ?? 0) : null,
      awaySmall: hasPins ? (rt?.awaySmall ?? 0) : null,
      homeBig: roundDone ? (rt?.homeBig ?? 0) : null,
      awayBig: roundDone ? (rt?.awayBig ?? 0) : null,
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
      homeBig: null,
      awayBig: null,
      homePins: null,
      awayPins: null,
      duels: Array.from({ length: size }, (_, i) => {
        const homeName = slotLabel("home", i);
        const awayName = slotLabel("away", i);
        return {
          lane: i + 1,
          homeName,
          awayName,
          homeFirstName: homeName,
          homeSurname: "",
          awayFirstName: awayName,
          awaySurname: "",
          homePins: null,
          awayPins: null,
          homeSmall: null,
          awaySmall: null,
        };
      }),
    });
  }

  return {
    complete: totals.complete,
    round: match.round,
    homeName: labels?.homeName || home?.name || "Domači",
    awayName: labels?.awayName || away?.name || "Gostje",
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
