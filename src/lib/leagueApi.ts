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
};

export async function fetchLeague(id?: string): Promise<LeaguePayload> {
  const url = id ? `/api/league?id=${encodeURIComponent(id)}` : "/api/league";
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error("league");
  return (await res.json()) as LeaguePayload;
}

export async function saveLeague(id: string, data: LeagueState): Promise<boolean> {
  const res = await fetch("/api/league", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data }),
  });
  return res.ok;
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
  players: { id: string; teamId: string; name: string; gender: "M" | "F"; bzsMember: boolean }[],
): Promise<boolean> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveRoster", id, teamId, players }),
  });
  return res.ok;
}

export async function saveMatchLineup(
  id: string,
  matchId: string,
  side: "home" | "away",
  starters: string[],
  bench: string[],
): Promise<boolean> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveLineup", id, matchId, side, starters, bench }),
  });
  return res.ok;
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
