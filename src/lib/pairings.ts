import type { MatchRound } from "./types";

export type PairingSlot = { homeSlot: number; awaySlot: number; lane: number };

/**
 * Paritve z uradnega zapisnika (A1–A4 proti B1–B4).
 * 1. krog: A1–B4, A2–B3, A3–B2, A4–B1
 * 2. krog: A3–B1, A4–B2, A1–B3, A2–B4
 * 3. krog: A2–B2, A1–B1, A4–B4, A3–B3
 * 4. krog: A4–B3, A3–B4, A2–B1, A1–B2
 */
const OFFICIAL_4: PairingSlot[][] = [
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

/** Trening 2v2 — križanje in vzporedno. */
const SIZE_2: PairingSlot[][] = [
  [
    { homeSlot: 0, awaySlot: 1, lane: 1 },
    { homeSlot: 1, awaySlot: 0, lane: 2 },
  ],
  [
    { homeSlot: 0, awaySlot: 0, lane: 1 },
    { homeSlot: 1, awaySlot: 1, lane: 2 },
  ],
  [
    { homeSlot: 0, awaySlot: 1, lane: 1 },
    { homeSlot: 1, awaySlot: 0, lane: 2 },
  ],
  [
    { homeSlot: 0, awaySlot: 0, lane: 1 },
    { homeSlot: 1, awaySlot: 1, lane: 2 },
  ],
];

/** Trening 3v3 — rotacija. */
const SIZE_3: PairingSlot[][] = [
  [
    { homeSlot: 0, awaySlot: 2, lane: 1 },
    { homeSlot: 1, awaySlot: 1, lane: 2 },
    { homeSlot: 2, awaySlot: 0, lane: 3 },
  ],
  [
    { homeSlot: 0, awaySlot: 1, lane: 1 },
    { homeSlot: 1, awaySlot: 0, lane: 2 },
    { homeSlot: 2, awaySlot: 2, lane: 3 },
  ],
  [
    { homeSlot: 0, awaySlot: 0, lane: 1 },
    { homeSlot: 1, awaySlot: 2, lane: 2 },
    { homeSlot: 2, awaySlot: 1, lane: 3 },
  ],
  [
    { homeSlot: 0, awaySlot: 2, lane: 1 },
    { homeSlot: 1, awaySlot: 1, lane: 2 },
    { homeSlot: 2, awaySlot: 0, lane: 3 },
  ],
];

/** Koliko mest A1… uporabiti glede na sestavo (2–4). */
export function lineupSize(homeStarters: string[], awayStarters: string[]): number {
  const h = homeStarters.filter(Boolean).length;
  const a = awayStarters.filter(Boolean).length;
  if (h === 0 && a === 0) return 4;
  if (h === 0) return Math.max(2, Math.min(4, a));
  if (a === 0) return Math.max(2, Math.min(4, h));
  return Math.max(2, Math.min(4, Math.min(h, a)));
}

export function pairingTemplate(size = 4): PairingSlot[][] {
  const n = Math.max(2, Math.min(4, size));
  if (n === 2) return SIZE_2;
  if (n === 3) return SIZE_3;
  return OFFICIAL_4;
}

export function slotLabel(side: "home" | "away", index: number): string {
  const letter = side === "home" ? "A" : "B";
  return `${letter}${index + 1}`;
}

/**
 * Privzeto uradna tekma (4v4). Trening poda `size` 2–4.
 * Nikoli ne skrči uradne tekme samo zato, ker sestava še ni polna.
 */
export function emptyRounds(
  homeStarters: string[],
  awayStarters: string[],
  size = 4,
): MatchRound[] {
  const n = Math.max(2, Math.min(4, size));
  return pairingTemplate(n).map((games) => ({
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
