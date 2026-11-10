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
  if (match?.liveOnTv) return true;
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
  // Po prvem keglju / menjavah ne povoziti parov z začetno sestavo.
  if (lineupLocked(match.rounds)) {
    return next;
  }
  const nominated = new Set([...(starters ?? []), ...(bench ?? [])].filter(Boolean));
  next.rounds = PAIRINGS.map((games, ri) => ({
    games: games.map((g, gi) => {
      const prev = match.rounds?.[ri]?.games?.[gi];
      const prevHome = prev?.homePlayerId ?? "";
      const prevAway = prev?.awayPlayerId ?? "";
      const templateHome = home[g.homeSlot] ?? "";
      const templateAway = away[g.awaySlot] ?? "";
      return {
        homePlayerId:
          side === "home"
            ? prevHome && nominated.has(prevHome)
              ? prevHome
              : templateHome
            : prevHome || templateHome,
        awayPlayerId:
          side === "away"
            ? prevAway && nominated.has(prevAway)
              ? prevAway
              : templateAway
            : prevAway || templateAway,
        lane: g.lane,
        homePins: prev?.homePins ?? null,
        awayPins: prev?.awayPins ?? null,
      };
    }),
  }));
  return preserveSubstitutions(repairDuplicateLanePlayers(next));
}

export function playerOnOtherLane(games, side, playerId, gameIndex) {
  if (!playerId) return false;
  const key = side === "home" ? "homePlayerId" : "awayPlayerId";
  return (games ?? []).some((game, index) => index !== gameIndex && game?.[key] === playerId);
}

function sidePlayerKey(side) {
  return side === "home" ? "homePlayerId" : "awayPlayerId";
}

function slotAt(side, roundIndex, gameIndex) {
  const pair = PAIRINGS[roundIndex]?.[gameIndex];
  if (!pair) return null;
  return side === "home" ? pair.homeSlot : pair.awaySlot;
}

/** Odhajajoči se ne sme vrniti. Menjava (A5/A6, B5/B6) ostane na voljo. */
export function substitutedOutIds(match, side) {
  const key = sidePlayerKey(side);
  const rounds = match?.rounds ?? [];
  const out = new Set();
  const active = new Map();
  rounds.forEach((round, ri) => {
    (round?.games ?? []).forEach((game, gi) => {
      const slot = slotAt(side, ri, gi);
      const id = game?.[key] ?? "";
      if (slot == null || !id) return;
      const prev = active.get(slot);
      if (!prev) {
        active.set(slot, id);
        return;
      }
      if (prev === id || out.has(id)) return;
      out.add(prev);
      active.set(slot, id);
    });
  });
  return out;
}

/** Če je odhajajoči spet vpisan, ga zamenja igralec, ki je ostal v igri. */
export function preserveSubstitutions(match) {
  const rounds = (match?.rounds ?? []).map((round) => ({
    games: (round?.games ?? []).map((game) => ({ ...game })),
  }));
  let changed = false;
  for (const side of ["home", "away"]) {
    const key = sidePlayerKey(side);
    const out = new Set();
    const active = new Map();
    rounds.forEach((round, ri) => {
      round.games.forEach((game, gi) => {
        const slot = slotAt(side, ri, gi);
        const id = game?.[key] ?? "";
        if (slot == null || !id) return;
        const prev = active.get(slot);
        if (!prev) {
          active.set(slot, id);
          return;
        }
        if (prev === id) return;
        if (out.has(id)) {
          game[key] = prev;
          changed = true;
          return;
        }
        out.add(prev);
        active.set(slot, id);
      });
    });
  }
  if (!changed) return match;
  return { ...match, rounds };
}

/** Menjava se ujame naprej po krogih; odhajajoči ne more nazaj. */
export function applyPlayerSubstitution(match, roundIndex, gameIndex, side, playerId) {
  const key = sidePlayerKey(side);
  const round = match?.rounds?.[roundIndex];
  const game = round?.games?.[gameIndex];
  if (!game) return match;

  const starters = side === "home" ? match.homeStarters : match.awayStarters;
  const bench = side === "home" ? match.homeBench : match.awayBench;
  const allowed = new Set([...(starters ?? []), ...(bench ?? [])].filter(Boolean));
  if (playerId && !allowed.has(playerId)) return match;
  if (playerId && playerOnOtherLane(round.games, side, playerId, gameIndex)) return match;
  if (playerId && substitutedOutIds(match, side).has(playerId)) return match;

  const oldId = game[key] ?? "";
  const pid = playerId || "";

  if (!pid || oldId === pid) {
    return {
      ...match,
      rounds: match.rounds.map((r, ri) => {
        if (ri !== roundIndex) return r;
        return {
          games: r.games.map((g, gi) => (gi !== gameIndex ? g : { ...g, [key]: pid })),
        };
      }),
    };
  }

  const slotAt = (ri, gi) => {
    const pair = PAIRINGS[ri]?.[gi];
    if (!pair) return null;
    return side === "home" ? pair.homeSlot : pair.awaySlot;
  };
  const fromSlot = slotAt(roundIndex, gameIndex);

  return {
    ...match,
    rounds: match.rounds.map((r, ri) => {
      if (ri < roundIndex) return r;
      const games = (r.games ?? []).map((g) => ({ ...g }));
      const take = (gi) => {
        games[gi] = { ...games[gi], [key]: pid };
      };
      if (ri === roundIndex) {
        take(gameIndex);
        return { ...r, games };
      }
      const hits = [];
      games.forEach((g, gi) => {
        const sameSlot = fromSlot != null && slotAt(ri, gi) === fromSlot;
        const samePerson = Boolean(oldId) && g[key] === oldId;
        if (sameSlot || samePerson) hits.push(gi);
      });
      const slotHit = hits.find((gi) => slotAt(ri, gi) === fromSlot);
      const chosen = slotHit != null ? slotHit : hits[0];
      if (chosen != null) take(chosen);
      return { ...r, games };
    }),
  };
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
      const starterIds = new Set((starters ?? []).filter(Boolean));
      games.forEach((game, gi) => {
        const slot = side === "home" ? PAIRINGS[ri]?.[gi]?.homeSlot : PAIRINGS[ri]?.[gi]?.awaySlot;
        const expected = slot == null ? "" : (starters?.[slot] ?? "");
        const id = game[key];
        if (id && starterIds.has(id) && (counts.get(id) ?? 0) > 1 && id !== expected) {
          game[key] = expected;
          changed = true;
        }
      });
    }
    return { ...round, games };
  });
  return changed ? { ...match, rounds } : match;
}
