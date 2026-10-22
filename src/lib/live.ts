import type { Match } from "./types";

/** Termini so 18:00, 19:30, 21:00 — en slot traja do naslednjega. */
export const MATCH_SLOT_MS = 90 * 60 * 1000;

function startMs(match: Match): number | null {
  if (!match.startsAt) return null;
  const t = new Date(match.startsAt).getTime();
  return Number.isNaN(t) ? null : t;
}

export function matchesInPlay(matches: Match[], now: number, durationMs = MATCH_SLOT_MS): Match[] {
  return matches
    .filter((match) => {
      const start = startMs(match);
      if (start == null) return false;
      return now >= start && now < start + durationMs;
    })
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

/** Za razpored »V živo«: admin force + tekme v trenutnem 90-min terminu. */
export function matchesShowingLive(matches: Match[], now: number, durationMs = MATCH_SLOT_MS): Match[] {
  const forced = matches.filter((m) => m.liveOnTv);
  if (forced.length > 0) {
    return [...forced].sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  }
  return matchesInPlay(matches, now, durationMs);
}

export function nextSlotMatches(matches: Match[], now: number): Match[] {
  let soonest: number | null = null;
  for (const match of matches) {
    const start = startMs(match);
    if (start == null || start < now) continue;
    if (soonest == null || start < soonest) soonest = start;
  }
  if (soonest == null) return [];
  return matches
    .filter((match) => startMs(match) === soonest)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}
