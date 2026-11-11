export type PresenceKind = "tv" | "standings" | "results" | "other";

export type PresenceCounts = {
  total: number;
  tv: number;
  standings: number;
  results: number;
  other: number;
};

const VIEWER_KEY = "liga-viewer";

/** TV zaslon, lestvica, rezultati, vse ostalo (razpored, ekipe, vnos). */
export function presenceKind(search: string): PresenceKind {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const q = new URLSearchParams(raw);
  const display = q.get("display");
  if (display === "live" || display === "board") return "tv";
  const page = q.get("page");
  if (page === "standings" || page === "players") return "standings";
  if (page === "results") return "results";
  return "other";
}

export function presenceSummary(counts: PresenceCounts): string {
  const parts = [
    `${counts.tv} TV`,
    `${counts.standings} lestvica`,
    `${counts.results} rezultati`,
  ];
  if (counts.other > 0) parts.push(`${counts.other} ostalo`);
  return parts.join(" · ");
}

function randomViewerId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** En id na zavihek. Dva zavihka štejeta kot dva gledalca. */
export function viewerId(): string {
  try {
    const existing = sessionStorage.getItem(VIEWER_KEY);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  } catch {
    /* zasebni način */
  }
  const id = randomViewerId();
  try {
    sessionStorage.setItem(VIEWER_KEY, id);
  } catch {
    /* id ostane v pomnilniku tega klica */
  }
  return id;
}
