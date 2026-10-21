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

export function lineupsRevealed(match, now = Date.now()) {
  if (lineupLocked(match?.rounds)) return true;
  if (!match?.startsAt) return false;
  const start = new Date(match.startsAt).getTime();
  return !Number.isNaN(start) && now >= start;
}

function blankSide(match, side) {
  const rounds = (match.rounds ?? []).map((round) => ({
    games: (round.games ?? []).map((game) =>
      side === "home" ? { ...game, homePlayerId: "" } : { ...game, awayPlayerId: "" },
    ),
  }));
  if (side === "home") {
    return {
      ...match,
      homeStarters: Array.from({ length: PLAYERS_ON_LANE }, () => ""),
      homeBench: [],
      rounds,
    };
  }
  return {
    ...match,
    awayStarters: Array.from({ length: PLAYERS_ON_LANE }, () => ""),
    awayBench: [],
    rounds,
  };
}

export function maskMatchLineups(match, viewer = {}, now = Date.now()) {
  if (viewer.admin || lineupsRevealed(match, now)) return match;
  const side = teamMatchSide(match, viewer.teamId);
  if (side === "home") return blankSide(match, "away");
  if (side === "away") return blankSide(match, "home");
  return blankSide(blankSide(match, "home"), "away");
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
  return repairDuplicateLanePlayers(next);
}

export function playerOnOtherLane(games, side, playerId, gameIndex) {
  if (!playerId) return false;
  const key = side === "home" ? "homePlayerId" : "awayPlayerId";
  return (games ?? []).some((game, index) => index !== gameIndex && game?.[key] === playerId);
}

export function repairDuplicateLanePlayers(match) {
  let changed = false;
  const rounds = (match.rounds ?? []).map((round, ri) => {
    const games = (round.games ?? []).map((game) => ({ ...game }));
    for (const side of ["home", "away"]) {
      const key = side === "home" ? "homePlayerId" : "awayPlayerId";
      const starters = side === "home" ? match.homeStarters : match.awayStarters;
      const counts = new Map();
      for (const game of games) {
        const id = game[key];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      games.forEach((game, gi) => {
        const slot = side === "home" ? PAIRINGS[ri]?.[gi]?.homeSlot : PAIRINGS[ri]?.[gi]?.awaySlot;
        const expected = slot == null ? "" : (starters?.[slot] ?? "");
        const id = game[key];
        if (id && (counts.get(id) ?? 0) > 1 && id !== expected) {
          game[key] = expected;
          changed = true;
        }
      });
    }
    return { ...round, games };
  });
  return changed ? { ...match, rounds } : match;
}
