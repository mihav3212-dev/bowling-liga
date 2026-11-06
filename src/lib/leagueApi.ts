import type { LeagueState, SeasonInfo, TrainingSession } from "./types";

export type LeaguePayload = {
  storage: "local" | "db";
  current?: {
    id: string;
    label: string;
    archived: boolean;
    training?: boolean;
    updatedAt?: string;
    data: LeagueState;
  };
  seasons?: SeasonInfo[];
  ok?: boolean;
  conflict?: boolean;
};

/** Izid shranjevanja: ok / napaka / konflikt (v bazi je novejša različica). */
export type SaveResult = {
  ok: boolean;
  conflict?: boolean;
  payload?: LeaguePayload;
};

export async function fetchLeague(id?: string): Promise<LeaguePayload> {
  const url = id ? `/api/league?id=${encodeURIComponent(id)}` : "/api/league";
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error("league");
  return (await res.json()) as LeaguePayload;
}

export async function saveLeague(
  id: string,
  data: LeagueState,
  opts?: { baseUpdatedAt?: string | null },
): Promise<SaveResult> {
  const res = await fetch("/api/league", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data, baseUpdatedAt: opts?.baseUpdatedAt ?? undefined }),
  });
  let payload: LeaguePayload | undefined;
  try {
    payload = (await res.json()) as LeaguePayload;
  } catch {
    payload = undefined;
  }
  if (res.ok) return { ok: true, payload };
  return { ok: false, conflict: Boolean(payload?.conflict) || res.status === 409, payload };
}

export async function archiveLeague(id?: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "archive", id }),
  });
  if (!res.ok) throw new Error("archive");
  return (await res.json()) as LeaguePayload;
}

export async function reopenLeague(id?: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reopen", id }),
  });
  if (!res.ok) throw new Error("reopen");
  return (await res.json()) as LeaguePayload;
}

export async function createLeague(label: string, data?: LeagueState): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", label, data }),
  });
  if (!res.ok) throw new Error("create");
  return (await res.json()) as LeaguePayload;
}

export async function createLeagueFromSource(
  label: string,
  sourceId: string,
  teamIds: string[],
  includePlayers: boolean,
): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createFromSource",
      label,
      sourceId,
      teamIds,
      includePlayers,
    }),
  });
  if (!res.ok) throw new Error("createFromSource");
  return (await res.json()) as LeaguePayload;
}

export async function replaceLeague(id: string, data: LeagueState, label?: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", id, data, label }),
  });
  if (!res.ok) throw new Error("replace");
  return (await res.json()) as LeaguePayload;
}

export async function renameLeague(id: string, label: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rename", id, label }),
  });
  if (!res.ok) throw new Error("rename");
  return (await res.json()) as LeaguePayload;
}

export async function saveMatchGame(
  id: string,
  patch: {
    matchId: string;
    roundIndex: number;
    gameIndex: number;
    side: "home" | "away";
    pins?: number | null;
    playerId?: string;
  },
): Promise<LeaguePayload | null> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveGame", id, ...patch }),
  });
  if (!res.ok) return null;
  return (await res.json()) as LeaguePayload;
}

export async function saveTeamRoster(
  id: string,
  teamId: string,
  players: {
    id: string;
    teamId: string;
    name: string;
    firstName?: string;
    surname?: string;
    gender: "M" | "F";
    bzsMember: boolean;
  }[],
  opts?: { baseUpdatedAt?: string | null },
): Promise<SaveResult> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveRoster",
      id,
      teamId,
      players,
      baseUpdatedAt: opts?.baseUpdatedAt ?? undefined,
    }),
  });
  let payload: LeaguePayload | undefined;
  try {
    payload = (await res.json()) as LeaguePayload;
  } catch {
    payload = undefined;
  }
  if (res.ok) return { ok: true, payload };
  return { ok: false, conflict: Boolean(payload?.conflict) || res.status === 409, payload };
}

export async function saveAdminMatch(
  id: string,
  match: {
    id: string;
    homeStarters: string[];
    awayStarters: string[];
    homeBench: string[];
    awayBench: string[];
    rounds: { games: { homePins: number | null; awayPins: number | null; homePlayerId: string; awayPlayerId: string; lane: number }[] }[];
  },
  opts?: { baseUpdatedAt?: string | null },
): Promise<SaveResult> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveMatch",
      id,
      match,
      baseUpdatedAt: opts?.baseUpdatedAt ?? undefined,
    }),
  });
  let payload: LeaguePayload | undefined;
  try {
    payload = (await res.json()) as LeaguePayload;
  } catch {
    payload = undefined;
  }
  if (res.ok) return { ok: true, payload };
  return { ok: false, conflict: Boolean(payload?.conflict) || res.status === 409, payload };
}

export async function saveMatchLineup(
  id: string,
  matchId: string,
  side: "home" | "away",
  starters: string[],
  bench: string[],
  opts?: { baseStarters?: string[]; baseBench?: string[] },
): Promise<SaveResult> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveLineup",
      id,
      matchId,
      side,
      starters,
      bench,
      baseStarters: opts?.baseStarters,
      baseBench: opts?.baseBench,
    }),
  });
  let payload: LeaguePayload | undefined;
  try {
    payload = (await res.json()) as LeaguePayload;
  } catch {
    payload = undefined;
  }
  if (res.ok) return { ok: true, payload };
  return { ok: false, conflict: Boolean(payload?.conflict) || res.status === 409, payload };
}

export async function saveTeamTrainings(
  id: string,
  teamId: string,
  sessions: TrainingSession[],
): Promise<boolean> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveTraining", id, teamId, sessions }),
  });
  return res.ok;
}

export type SeasonSnapshotInfo = {
  id: string;
  seasonId: string;
  kind: string;
  round: number | null;
  label: string;
  createdAt?: string;
};

export async function listSeasonSnapshots(id?: string): Promise<SeasonSnapshotInfo[]> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listSnapshots", id }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { snapshots?: SeasonSnapshotInfo[] };
  return Array.isArray(body.snapshots) ? body.snapshots : [];
}

export async function createSeasonSnapshot(
  id?: string,
  label?: string,
): Promise<SeasonSnapshotInfo[]> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createSnapshot", id, label }),
  });
  if (!res.ok) throw new Error("snapshot");
  const body = (await res.json()) as { snapshots?: SeasonSnapshotInfo[] };
  return Array.isArray(body.snapshots) ? body.snapshots : [];
}

export async function restoreSeasonSnapshot(snapshotId: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restoreSnapshot", snapshotId }),
  });
  if (!res.ok) throw new Error("restore");
  return (await res.json()) as LeaguePayload;
}

export async function setTeamPassword(
  id: string,
  teamId: string,
  password: string,
): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setTeamPassword", id, teamId, password }),
  });
  if (!res.ok) throw new Error("password");
  return (await res.json()) as LeaguePayload;
}

export async function getDisplayPasswordStatus(): Promise<{ hasDisplayPassword: boolean }> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getDisplayPassword" }),
  });
  if (!res.ok) throw new Error("display");
  const body = (await res.json()) as { hasDisplayPassword?: boolean };
  return { hasDisplayPassword: Boolean(body.hasDisplayPassword) };
}

export async function setDisplayPassword(password: string): Promise<{ hasDisplayPassword: boolean }> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setDisplayPassword", password }),
  });
  if (!res.ok) throw new Error("display");
  const body = (await res.json()) as { hasDisplayPassword?: boolean };
  return { hasDisplayPassword: Boolean(body.hasDisplayPassword) };
}

export type InvitePreview = { ok: boolean; teamName?: string; expiresAt?: string; error?: string };

export async function createTeamInvite(
  id: string,
  teamId: string,
): Promise<LeaguePayload & { token: string; expiresAt: string }> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createInvite", id, teamId }),
  });
  if (!res.ok) throw new Error("invite");
  return (await res.json()) as LeaguePayload & { token: string; expiresAt: string };
}

export async function previewTeamInvite(token: string): Promise<InvitePreview> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "previewInvite", token: String(token ?? "").trim() }),
  });
  if (!res.ok) {
    try {
      return (await res.json()) as InvitePreview;
    } catch {
      return { ok: false, error: "invalid" };
    }
  }
  return (await res.json()) as InvitePreview;
}

export async function claimTeamInvite(token: string, password: string): Promise<InvitePreview> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "claimInvite", token: String(token ?? "").trim(), password }),
  });
  if (!res.ok) {
    try {
      return (await res.json()) as InvitePreview;
    } catch {
      return { ok: false, error: "invalid" };
    }
  }
  return (await res.json()) as InvitePreview;
}

export async function deleteLeague(id: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  if (!res.ok) throw new Error("delete");
  return (await res.json()) as LeaguePayload;
}

export type MatchEditLockResult = {
  ok: boolean;
  held?: boolean;
  conflict?: { label: string; updatedAt?: string };
  error?: string;
};

async function postEditLock(
  action: "claimEditLock" | "heartbeatEditLock" | "releaseEditLock",
  body: {
    id?: string;
    matchId: string;
    token: string;
    label?: string;
    force?: boolean;
  },
): Promise<MatchEditLockResult> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) return { ok: false };
  try {
    return (await res.json()) as MatchEditLockResult;
  } catch {
    return { ok: false };
  }
}

export function claimMatchEditLock(opts: {
  id?: string;
  matchId: string;
  token: string;
  label: string;
  force?: boolean;
}): Promise<MatchEditLockResult> {
  return postEditLock("claimEditLock", opts);
}

export function heartbeatMatchEditLock(opts: {
  id?: string;
  matchId: string;
  token: string;
  label: string;
}): Promise<MatchEditLockResult> {
  return postEditLock("heartbeatEditLock", opts);
}

export function releaseMatchEditLock(opts: {
  id?: string;
  matchId: string;
  token: string;
}): Promise<MatchEditLockResult> {
  return postEditLock("releaseEditLock", opts);
}

/** Ob zaprtju zavihka — brez čakanja na odgovor. */
export function releaseMatchEditLockBeacon(opts: {
  id?: string;
  matchId: string;
  token: string;
}): void {
  try {
    const body = JSON.stringify({ action: "releaseEditLock", ...opts });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/league", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/league", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
