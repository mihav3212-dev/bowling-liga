import { emptyRounds, lineupSize, nominatedIds, pairingTemplate } from "./pairings";
import { lineupLocked, MAX_BENCH, PLAYERS_ON_LANE } from "./scoring";
import type { GameScore, Match, Player } from "./types";

export function teamMatchSide(
  match: { homeTeamId: string; awayTeamId: string },
  teamId: string | null | undefined,
): "home" | "away" | null {
  if (!teamId) return null;
  if (match.homeTeamId === teamId) return "home";
  if (match.awayTeamId === teamId) return "away";
  return null;
}

/** Po začetku tekme (ura, prvi keglji ali ročni TV v živo) so sestave javne — TV / nasprotnik. */
export function lineupsRevealed(
  match: Pick<Match, "rounds" | "startsAt" | "liveOnTv">,
  now = Date.now(),
): boolean {
  if (match.liveOnTv) return true;
  if (lineupLocked(match.rounds)) return true;
  if (!match.startsAt) return false;
  const start = new Date(match.startsAt).getTime();
  return !Number.isNaN(start) && now >= start;
}

function blankSide(match: Match, side: "home" | "away"): Match {
  const rounds = (match.rounds ?? []).map((round) => ({
    games: (round.games ?? []).map((game) =>
      side === "home" ? { ...game, homePlayerId: "" } : { ...game, awayPlayerId: "" },
    ),
  }));
  if (side === "home") {
    return {
      ...match,
      homeStarters: Array.from({ length: PLAYERS_ON_LANE }, () => ""),
      homeBench: [],
      rounds,
    };
  }
  return {
    ...match,
    awayStarters: Array.from({ length: PLAYERS_ON_LANE }, () => ""),
    awayBench: [],
    rounds,
  };
}

/** Admin vidi vse; ekipa samo svojo sestavo do razkritja; javno oboje skrito. */
export function maskMatchLineups(
  match: Match,
  viewer: { admin?: boolean; teamId?: string | null },
  now = Date.now(),
): Match {
  if (viewer.admin || lineupsRevealed(match, now)) return match;
  const side = teamMatchSide(match, viewer.teamId);
  if (side === "home") return blankSide(match, "away");
  if (side === "away") return blankSide(match, "home");
  return blankSide(blankSide(match, "home"), "away");
}

export function rosterIdsForTeam(players: Player[], teamId: string): Set<string> {
  return new Set(players.filter((p) => p.teamId === teamId).map((p) => p.id));
}

export function sanitizeLineup(
  starters: string[],
  bench: string[],
  allowed: Set<string>,
): { starters: string[]; bench: string[] } {
  const used = new Set<string>();
  const cleanStarters: string[] = [];
  for (let i = 0; i < PLAYERS_ON_LANE; i++) {
    const id = starters[i] ?? "";
    if (id && allowed.has(id) && !used.has(id)) {
      used.add(id);
      cleanStarters.push(id);
    } else {
      cleanStarters.push("");
    }
  }
  const cleanBench: string[] = [];
  for (const id of bench) {
    if (cleanBench.length >= MAX_BENCH) break;
    if (id && allowed.has(id) && !used.has(id)) {
      used.add(id);
      cleanBench.push(id);
    }
  }
  return { starters: cleanStarters, bench: cleanBench };
}

export function applyLineup(
  match: Match,
  side: "home" | "away",
  starters: string[],
  bench: string[],
  /** Trening tekma: 2–4. Uradna liga vedno 4 (privzeto). */
  opts?: { flexiblePairing?: boolean },
): Match {
  const cleanStarters = starters.slice(0, PLAYERS_ON_LANE);
  while (cleanStarters.length < PLAYERS_ON_LANE) cleanStarters.push("");
  const cleanBench = bench.filter(Boolean).slice(0, MAX_BENCH);
  const next: Match = {
    ...match,
    ...(side === "home"
      ? { homeStarters: cleanStarters, homeBench: cleanBench }
      : { awayStarters: cleanStarters, awayBench: cleanBench }),
  };
  const home = side === "home" ? cleanStarters : next.homeStarters;
  const away = side === "away" ? cleanStarters : next.awayStarters;
  const pairingSize = opts?.flexiblePairing ? lineupSize(home, away) : PLAYERS_ON_LANE;
  const template = emptyRounds(home, away, pairingSize);
  next.rounds = template.map((round, ri) => ({
    games: round.games.map((game, gi) => ({
      ...game,
      homePins: match.rounds[ri]?.games[gi]?.homePins ?? null,
      awayPins: match.rounds[ri]?.games[gi]?.awayPins ?? null,
      homePlayerId:
        side === "home"
          ? game.homePlayerId
          : match.rounds[ri]?.games[gi]?.homePlayerId || game.homePlayerId,
      awayPlayerId:
        side === "away"
          ? game.awayPlayerId
          : match.rounds[ri]?.games[gi]?.awayPlayerId || game.awayPlayerId,
    })),
  }));
  return repairDuplicateLanePlayers(next);
}

/** Isti igralec ne sme stati na dveh stezah istega kroga. */
export function playerOnOtherLane(
  games: GameScore[],
  side: "home" | "away",
  playerId: string,
  gameIndex: number,
): boolean {
  if (!playerId) return false;
  const key = side === "home" ? "homePlayerId" : "awayPlayerId";
  return games.some((game, index) => index !== gameIndex && game[key] === playerId);
}

function sidePlayerKey(side: "home" | "away"): "homePlayerId" | "awayPlayerId" {
  return side === "home" ? "homePlayerId" : "awayPlayerId";
}

/**
 * Igralci, ki so že bili v igri, a v zadnjem zapolnjenem krogu niso več —
 * po menjavi ne smejo nazaj.
 */
export function substitutedOutIds(match: Match, side: "home" | "away"): Set<string> {
  const key = sidePlayerKey(side);
  const rounds = match.rounds ?? [];
  let lastIdx = -1;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if ((rounds[i]?.games ?? []).some((g) => Boolean(g[key]))) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx <= 0) return new Set();
  const active = new Set(
    (rounds[lastIdx]?.games ?? []).map((g) => g[key]).filter(Boolean) as string[],
  );
  const out = new Set<string>();
  for (let i = 0; i < lastIdx; i++) {
    for (const g of rounds[i]?.games ?? []) {
      const id = g[key];
      if (id && !active.has(id)) out.add(id);
    }
  }
  return out;
}

/**
 * Menjava: novi igralec na tej stezi + v vseh naslednjih krogih namesto odhajajočega.
 * Odhajajoči ne more več vstopiti.
 */
export function applyPlayerSubstitution(
  match: Match,
  roundIndex: number,
  gameIndex: number,
  side: "home" | "away",
  playerId: string,
): Match {
  const key = sidePlayerKey(side);
  const round = match.rounds[roundIndex];
  const game = round?.games[gameIndex];
  if (!game) return match;

  const starters = side === "home" ? match.homeStarters : match.awayStarters;
  const bench = side === "home" ? match.homeBench : match.awayBench;
  const allowed = new Set(nominatedIds(starters ?? [], bench ?? []));
  if (playerId && !allowed.has(playerId)) return match;
  if (playerId && playerOnOtherLane(round.games, side, playerId, gameIndex)) return match;
  if (playerId && substitutedOutIds(match, side).has(playerId)) return match;

  const oldId = game[key] ?? "";

  // Prazen vnos ali ista oseba / ni koga zamenjati → samo ta celica.
  if (!playerId || !oldId || oldId === playerId) {
    return {
      ...match,
      rounds: match.rounds.map((r, ri) => {
        if (ri !== roundIndex) return r;
        return {
          games: r.games.map((g, gi) =>
            gi !== gameIndex ? g : { ...g, [key]: playerId },
          ),
        };
      }),
    };
  }

  return {
    ...match,
    rounds: match.rounds.map((r, ri) => {
      if (ri < roundIndex) return r;
      return {
        games: r.games.map((g, gi) => {
          if (ri === roundIndex && gi === gameIndex) {
            return { ...g, [key]: playerId };
          }
          if (g[key] === oldId) {
            return { ...g, [key]: playerId };
          }
          return g;
        }),
      };
    }),
  };
}

/**
 * Če je isti igralec na dveh stezah, na napačni stezi ga zamenja tisti,
 * ki mu pripada oznaka (A1–A4 / B1–B4). Prava steza in menjave ostanejo.
 */
export function repairDuplicateLanePlayers(match: Match): Match {
  const size = Math.max(2, Math.min(4, match.rounds?.[0]?.games?.length || PLAYERS_ON_LANE));
  const slots = pairingTemplate(size);
  let changed = false;
  const rounds = (match.rounds ?? []).map((round, ri) => {
    const games = (round.games ?? []).map((game) => ({ ...game }));
    for (const side of ["home", "away"] as const) {
      const key = side === "home" ? "homePlayerId" : "awayPlayerId";
      const starters = side === "home" ? match.homeStarters : match.awayStarters;
      const counts = new Map<string, number>();
      for (const game of games) {
        const id = game[key];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      games.forEach((game, gi) => {
        const slot = side === "home" ? slots[ri]?.[gi]?.homeSlot : slots[ri]?.[gi]?.awaySlot;
        const expected = slot == null ? "" : (starters?.[slot] ?? "");
        const id = game[key];
        if (id && (counts.get(id) ?? 0) > 1 && id !== expected) {
          game[key] = expected;
          changed = true;
        }
      });
    }
    return { ...round, games };
  });
  return changed ? { ...match, rounds } : match;
}
