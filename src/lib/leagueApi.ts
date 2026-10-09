import type { LeagueState, SeasonInfo } from "./types";

export type LeaguePayload = {
  storage: "local" | "db";
  current?: {
    id: string;
    label: string;
    archived: boolean;
    updatedAt?: string;
    data: LeagueState;
  };
  seasons?: SeasonInfo[];
};

export async function fetchLeague(id?: string): Promise<LeaguePayload> {
  const url = id ? `/api/league?id=${encodeURIComponent(id)}` : "/api/league";
  const res = await fetch(url, { credentials: "same-origin" });
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

export async function archiveLeague(nextLabel: string): Promise<LeaguePayload> {
  const res = await fetch("/api/league", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "archive", nextLabel }),
  });
  if (!res.ok) throw new Error("archive");
  return (await res.json()) as LeaguePayload;
}
