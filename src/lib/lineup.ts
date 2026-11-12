import {
  emptyRounds,
  lineupSize,
  nominatedIds,
  pairingTemplate,
  playerLineupLabel,
} from "./pairings";
import { lineupLocked, MAX_BENCH, PLAYERS_ON_LANE } from "./scoring";
import type { GameScore, Match, MatchRound, Player } from "./types";

/** Dovolj polj za menjavo (uradna tekma ali trening). */
type LineupMatch = {
  homeStarters: string[];
  awayStarters: string[];
  homeBench: string[];
  awayBench: string[];
  rounds: MatchRound[];
};

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

/** Je bila na tekmi že narejena menjava (odhajajoči v rundah)? */
export function hasMidMatchSubstitutions(match: LineupMatch): boolean {
  return substitutedOutIds(match, "home").size > 0 || substitutedOutIds(match, "away").size > 0;
}

/**
 * Tekma za shrani / zapisnik: ohrani menjave v rundah, ne spreminjaj A1–A4 / A5–A6 nominacije.
 * Imena v PDF in shranjeni pari pridejo iz rounds.*.*PlayerId.
 */
export function matchSheetView<T extends LineupMatch>(match: T): T {
  return repairDuplicateLanePlayers(preserveSubstitutions(match));
}

/** Nominirana postava za oznake A1–A6 (brez prepisovanja po menjavi). */
export function nominationLineupIds(match: LineupMatch, side: "home" | "away"): string[] {
  const starters = side === "home" ? match.homeStarters : match.awayStarters;
  const bench = side === "home" ? match.homeBench : match.awayBench;
  return [...(starters ?? []), ...(bench ?? [])];
}

export type MatchSheetRoundRow = {
  roundIndex: number;
  gameIndex: number;
  homePlayerId: string;
  awayPlayerId: string;
  homeLabel: string;
  awayLabel: string;
};

/**
 * Vrstice zapisnika po krogih: ime = kdo je res igral (po menjavi),
 * oznaka A1–A6 = nominacija (ne prepisuj starterjev).
 */
export function matchSheetRoundRows(match: LineupMatch): MatchSheetRoundRow[] {
  const sheet = matchSheetView(match);
  const template = pairingTemplate(
    Math.max(2, Math.min(4, sheet.rounds[0]?.games?.length || PLAYERS_ON_LANE)),
  );
  const rows: MatchSheetRoundRow[] = [];
  sheet.rounds.forEach((round, ri) => {
    (round.games ?? []).forEach((game, gi) => {
      const slots = template[ri]?.[gi];
      rows.push({
        roundIndex: ri,
        gameIndex: gi,
        homePlayerId: game.homePlayerId ?? "",
        awayPlayerId: game.awayPlayerId ?? "",
        homeLabel: playerLineupLabel(
          "home",
          game.homePlayerId,
          sheet.homeStarters,
          sheet.homeBench,
          slots?.homeSlot,
        ),
        awayLabel: playerLineupLabel(
          "away",
          game.awayPlayerId,
          sheet.awayStarters,
          sheet.awayBench,
          slots?.awaySlot,
        ),
      });
    });
  });
  return rows;
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
  // Po prvem keglju / že narejenih menjavah ne povoziti parov z A1–A4 iz sestave.
  // Nominacija (homeStarters/…) ostane; v rundah samo pozdravimo morebitno povrnitev odhajajočega.
  if (lineupLocked(match.rounds) || hasMidMatchSubstitutions(match)) {
    return preserveSubstitutions(repairDuplicateLanePlayers(next));
  }
  const home = side === "home" ? cleanStarters : next.homeStarters;
  const away = side === "away" ? cleanStarters : next.awayStarters;
  const nominated = new Set(nominatedIds(cleanStarters, cleanBench));
  const pairingSize = opts?.flexiblePairing ? lineupSize(home, away) : PLAYERS_ON_LANE;
  const template = emptyRounds(home, away, pairingSize);
  next.rounds = template.map((round, ri) => ({
    games: round.games.map((game, gi) => {
      const prev = match.rounds[ri]?.games[gi];
      const prevHome = prev?.homePlayerId ?? "";
      const prevAway = prev?.awayPlayerId ?? "";
      return {
        ...game,
        homePins: prev?.homePins ?? null,
        awayPins: prev?.awayPins ?? null,
        homePlayerId:
          side === "home"
            ? prevHome && nominated.has(prevHome)
              ? prevHome
              : game.homePlayerId
            : prevHome || game.homePlayerId,
        awayPlayerId:
          side === "away"
            ? prevAway && nominated.has(prevAway)
              ? prevAway
              : game.awayPlayerId
            : prevAway || game.awayPlayerId,
      };
    }),
  }));
  return preserveSubstitutions(repairDuplicateLanePlayers(next));
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

function slotAtFor(
  side: "home" | "away",
  size: number,
  roundIndex: number,
  gameIndex: number,
): number | undefined {
  const template = pairingTemplate(size);
  return side === "home"
    ? template[roundIndex]?.[gameIndex]?.homeSlot
    : template[roundIndex]?.[gameIndex]?.awaySlot;
}

/**
 * Kdo je odšel iz igre in se ne sme več vrniti.
 * Odhajajoči je tisti, ki ga na istem mestu zamenja nekdo drug.
 * Novi (A5/A6) ostane na voljo, tudi če je shranjevanje za njim spet vpisalo starega.
 */
export function substitutedOutIds(match: LineupMatch, side: "home" | "away"): Set<string> {
  const key = sidePlayerKey(side);
  const rounds = match.rounds ?? [];
  const size = Math.max(2, Math.min(4, rounds[0]?.games?.length || PLAYERS_ON_LANE));
  const out = new Set<string>();
  const active = new Map<number, string>();
  rounds.forEach((round, ri) => {
    (round.games ?? []).forEach((game, gi) => {
      const slot = slotAtFor(side, size, ri, gi);
      const id = game[key] ?? "";
      if (slot == null || !id) return;
      const prev = active.get(slot);
      if (!prev) {
        active.set(slot, id);
        return;
      }
      if (prev === id || out.has(id)) return;
      out.add(prev);
      active.set(slot, id);
    });
  });
  return out;
}

/**
 * Če je odhajajoči po shranjevanju spet na svojem mestu, ga zamenja tisti,
 * ki je v igri. Sam odhod se ne da razveljaviti.
 */
export function preserveSubstitutions<T extends LineupMatch>(match: T): T {
  const rounds = (match.rounds ?? []).map((round) => ({
    games: (round.games ?? []).map((game) => ({ ...game })),
  }));
  const size = Math.max(2, Math.min(4, rounds[0]?.games?.length || PLAYERS_ON_LANE));
  let changed = false;
  for (const side of ["home", "away"] as const) {
    const key = sidePlayerKey(side);
    const out = new Set<string>();
    const active = new Map<number, string>();
    rounds.forEach((round, ri) => {
      round.games.forEach((game, gi) => {
        const slot = slotAtFor(side, size, ri, gi);
        const id = (game[key] ?? "") as string;
        if (slot == null || !id) return;
        const prev = active.get(slot);
        if (!prev) {
          active.set(slot, id);
          return;
        }
        if (prev === id) return;
        if (out.has(id)) {
          game[key] = prev;
          changed = true;
          return;
        }
        out.add(prev);
        active.set(slot, id);
      });
    });
  }
  if (!changed) return match;
  return { ...match, rounds: rounds as T["rounds"] };
}

/**
 * Menjava: novi igralec na tej stezi + v vseh naslednjih krogih namesto odhajajočega.
 * Odhajajoči ne more več vstopiti.
 */
export function applyPlayerSubstitution<T extends LineupMatch>(
  match: T,
  roundIndex: number,
  gameIndex: number,
  side: "home" | "away",
  playerId: string,
): T {
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

  // Brisanje ali ista oseba → samo ta celica. Menjava gre naprej po parih.
  if (!playerId || oldId === playerId) {
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

  const size = Math.max(2, Math.min(4, match.rounds[0]?.games?.length || PLAYERS_ON_LANE));
  const template = pairingTemplate(size);
  const slotAt = (ri: number, gi: number) =>
    side === "home" ? template[ri]?.[gi]?.homeSlot : template[ri]?.[gi]?.awaySlot;
  const fromSlot = slotAt(roundIndex, gameIndex);

  return {
    ...match,
    rounds: match.rounds.map((r, ri) => {
      if (ri < roundIndex) return r;
      const games = r.games.map((g) => ({ ...g }));
      const take = (gi: number) => {
        games[gi] = { ...games[gi], [key]: playerId };
      };
      if (ri === roundIndex) {
        take(gameIndex);
        return { ...r, games };
      }
      // Naprej: isto mesto v rotaciji (A1 → A5) ima prednost pred morebitnim drugim parom.
      const hits: number[] = [];
      games.forEach((g, gi) => {
        const sameSlot = fromSlot != null && slotAt(ri, gi) === fromSlot;
        const samePerson = Boolean(oldId) && g[key] === oldId;
        if (sameSlot || samePerson) hits.push(gi);
      });
      const slotHit = hits.find((gi) => slotAt(ri, gi) === fromSlot);
      const chosen = slotHit != null ? slotHit : hits[0];
      if (chosen != null) take(chosen);
      return { ...r, games };
    }),
  };
}

/**
 * Če je isti igralec na dveh stezah, na napačni stezi ga zamenja tisti,
 * ki mu pripada oznaka (A1–A4 / B1–B4). Prava steza in menjave ostanejo.
 */
export function repairDuplicateLanePlayers<T extends LineupMatch>(match: T): T {
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
      const starterIds = new Set((starters ?? []).filter(Boolean));
      games.forEach((game, gi) => {
        const slot = side === "home" ? slots[ri]?.[gi]?.homeSlot : slots[ri]?.[gi]?.awaySlot;
        const expected = slot == null ? "" : (starters?.[slot] ?? "");
        const id = game[key];
        // Menjava (A5/A6) ni starter — ne vračaj je nazaj na A1–A4.
        if (id && starterIds.has(id) && (counts.get(id) ?? 0) > 1 && id !== expected) {
          game[key] = expected;
          changed = true;
        }
      });
    }
    return { ...round, games };
  });
  return changed ? { ...match, rounds: rounds as T["rounds"] } : match;
}
