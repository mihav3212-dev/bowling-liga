import { uid } from "./ids";
import { seasonIsComplete } from "./scoring";
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

function isSeason2026(season: StoredSeason): boolean {
  const label = season.label ?? season.data.seasonTitle ?? "";
  return season.data.seasonKey === "2026-27" || /2026\s*\/\s*2027|2026\s*\/\s*27/.test(label);
}

/** Napačno zaprte nedokončane sezone 2026/27 spet odpre in jih naredi trenutne. */
function recoverActive2026(vault: SeasonVault): SeasonVault {
  const closed = vault.seasons.filter((s) => isSeason2026(s) && s.archived && !seasonIsComplete(s.data));
  if (closed.length === 0) return vault;
  const id = closed[0].id;
  const next: SeasonVault = {
    currentId: id,
    seasons: vault.seasons.map((s) => (closed.some((c) => c.id === s.id) ? { ...s, archived: false } : s)),
  };
  saveVault(next);
  return next;
}

export function loadVault(fallbackState: LeagueState): SeasonVault {
  const stored = readJson<SeasonVault>(VAULT_KEY);
  if (stored?.seasons?.length && stored.currentId) {
    return recoverActive2026(stored);
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

export function addVaultSeason(vault: SeasonVault, label: string, data: LeagueState): SeasonVault {
  const id = uid("s");
  const next: SeasonVault = {
    currentId: id,
    seasons: [{ id, label, archived: false, data }, ...vault.seasons],
  };
  saveVault(next);
  return next;
}

export function closeVaultSeason(vault: SeasonVault): SeasonVault {
  const next: SeasonVault = {
    ...vault,
    seasons: vault.seasons.map((s) => (s.id === vault.currentId ? { ...s, archived: true } : s)),
  };
  saveVault(next);
  return next;
}

export function reopenVaultSeason(vault: SeasonVault, id: string): SeasonVault {
  const next: SeasonVault = {
    currentId: id,
    seasons: vault.seasons.map((s) => (s.id === id ? { ...s, archived: false } : s)),
  };
  saveVault(next);
  return next;
}
