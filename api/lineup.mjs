const PLAYERS_ON_LANE = 4;
const MAX_BENCH = 2;

const PAIRINGS = [
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

export function lineupLocked(rounds) {
  return Boolean(rounds?.[0]?.games?.some((game) => game.homePins != null || game.awayPins != null));
}

export function teamMatchSide(match, teamId) {
  if (!teamId || !match) return null;
  if (match.homeTeamId === teamId) return "home";
  if (match.awayTeamId === teamId) return "away";
  return null;
}

export function sanitizeLineup(starters, bench, allowed) {
  const used = new Set();
  const cleanStarters = [];
  for (let i = 0; i < PLAYERS_ON_LANE; i++) {
    const id = starters?.[i] ?? "";
    if (id && allowed.has(id) && !used.has(id)) {
      used.add(id);
      cleanStarters.push(id);
    } else {
      cleanStarters.push("");
    }
  }
  const cleanBench = [];
  for (const id of bench ?? []) {
    if (cleanBench.length >= MAX_BENCH) break;
    if (id && allowed.has(id) && !used.has(id)) {
      used.add(id);
      cleanBench.push(id);
    }
  }
  return { starters: cleanStarters, bench: cleanBench };
}

export function applyLineup(match, side, starters, bench) {
  const home = side === "home" ? starters : match.homeStarters;
  const away = side === "away" ? starters : match.awayStarters;
  const next = {
    ...match,
    ...(side === "home"
      ? { homeStarters: starters, homeBench: bench }
      : { awayStarters: starters, awayBench: bench }),
  };
  next.rounds = PAIRINGS.map((games, ri) => ({
    games: games.map((g, gi) => ({
      homePlayerId:
        side === "home" ? (home[g.homeSlot] ?? "") : match.rounds?.[ri]?.games?.[gi]?.homePlayerId || home[g.homeSlot] || "",
      awayPlayerId:
        side === "away" ? (away[g.awaySlot] ?? "") : match.rounds?.[ri]?.games?.[gi]?.awayPlayerId || away[g.awaySlot] || "",
      lane: g.lane,
      homePins: match.rounds?.[ri]?.games?.[gi]?.homePins ?? null,
      awayPins: match.rounds?.[ri]?.games?.[gi]?.awayPins ?? null,
    })),
  }));
  return next;
}
