import { uid } from "./ids";
import type { LeagueState, SeasonInfo } from "./types";

const STATE_KEY = "bowling-liga-v2";
const VAULT_KEY = "bowling-liga-seasons-v1";

export type StoredSeason = {
  id: string;
  label: string;
  archived: boolean;
  data: LeagueState;
};

export type SeasonVault = {
  currentId: string;
  seasons: StoredSeason[];
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadState(): LeagueState | null {
  return readJson<LeagueState>(STATE_KEY);
}

export function saveState(state: LeagueState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(STATE_KEY);
}

function labelOf(state: LeagueState, fallback: string): string {
  return state.seasonTitle?.trim() || fallback;
}

export function loadVault(fallbackState: LeagueState): SeasonVault {
  const stored = readJson<SeasonVault>(VAULT_KEY);
  if (stored?.seasons?.length && stored.currentId) {
    return stored;
  }
  const legacy = loadState() ?? fallbackState;
  const id = uid("s");
  const vault: SeasonVault = {
    currentId: id,
    seasons: [
      {
        id,
        label: labelOf(legacy, "2026/2027"),
        archived: false,
        data: legacy,
      },
    ],
  };
  saveVault(vault);
  return vault;
}

export function saveVault(vault: SeasonVault): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  const current = vault.seasons.find((s) => s.id === vault.currentId);
  if (current) saveState(current.data);
}

export function vaultInfos(vault: SeasonVault): SeasonInfo[] {
  return vault.seasons.map((s) => ({
    id: s.id,
    label: s.label,
    archived: s.archived,
  }));
}

export function writeCurrent(vault: SeasonVault, data: LeagueState): SeasonVault {
  const next: SeasonVault = {
    ...vault,
    seasons: vault.seasons.map((s) => (s.id === vault.currentId && !s.archived ? { ...s, data } : s)),
  };
  saveVault(next);
  return next;
}

export function archiveVault(vault: SeasonVault, nextLabel: string, empty: LeagueState): SeasonVault {
  const id = uid("s");
  const next: SeasonVault = {
    currentId: id,
    seasons: [
      { id, label: nextLabel, archived: false, data: empty },
      ...vault.seasons.map((s) =>
        s.id === vault.currentId ? { ...s, archived: true, label: s.label } : s,
      ),
    ],
  };
  saveVault(next);
  return next;
}
