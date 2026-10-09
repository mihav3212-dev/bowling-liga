import type { MatchRound } from "./types";

/**
 * Paritve z uradnega zapisnika (A1–A4 proti B1–B4).
 * 1. krog: A1–B4, A2–B3, A3–B2, A4–B1
 * 2. krog: A3–B1, A4–B2, A1–B3, A2–B4
 * 3. krog: A2–B2, A1–B1, A4–B4, A3–B3
 * 4. krog: A4–B3, A3–B4, A2–B1, A1–B2
 */
export function pairingTemplate(): { homeSlot: number; awaySlot: number; lane: number }[][] {
  return [
    [
      { homeSlot: 0, awaySlot: 3, lane: 1 },
      { homeSlot: 1, awaySlot: 2, lane: 2 },
      { homeSlot: 2, awaySlot: 1, lane: 3 },
      { homeSlot: 3, awaySlot: 0, lane: 4 },
    ],
    [
      { homeSlot: 2, awaySlot: 0, lane: 1 },
      { homeSlot: 3, awaySlot: 1, lane: 2 },
      { homeSlot: 0, awaySlot: 2, lane: 3 },
      { homeSlot: 1, awaySlot: 3, lane: 4 },
    ],
    [
      { homeSlot: 1, awaySlot: 1, lane: 1 },
      { homeSlot: 0, awaySlot: 0, lane: 2 },
      { homeSlot: 3, awaySlot: 3, lane: 3 },
      { homeSlot: 2, awaySlot: 2, lane: 4 },
    ],
    [
      { homeSlot: 3, awaySlot: 2, lane: 1 },
      { homeSlot: 2, awaySlot: 3, lane: 2 },
      { homeSlot: 1, awaySlot: 0, lane: 3 },
      { homeSlot: 0, awaySlot: 1, lane: 4 },
    ],
  ];
}

export function slotLabel(side: "home" | "away", index: number): string {
  const letter = side === "home" ? "A" : "B";
  return `${letter}${index + 1}`;
}

export function emptyRounds(homeStarters: string[], awayStarters: string[]): MatchRound[] {
  return pairingTemplate().map((games) => ({
    games: games.map((g) => ({
      homePlayerId: homeStarters[g.homeSlot] ?? "",
      awayPlayerId: awayStarters[g.awaySlot] ?? "",
      lane: g.lane,
      homePins: null,
      awayPins: null,
    })),
  }));
}

export function nominatedIds(starters: string[], bench: string[]): string[] {
  return [...starters, ...bench].filter(Boolean);
}
