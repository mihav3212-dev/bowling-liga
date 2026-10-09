import type { LeagueState } from "./types";

const KEY = "bowling-liga-v2";

export function loadState(): LeagueState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LeagueState;
  } catch {
    return null;
  }
}

export function saveState(state: LeagueState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}
