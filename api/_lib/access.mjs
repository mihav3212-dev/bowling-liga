export function defaultTeamPerms(partial) {
  const next = {
    roster: false,
    lineup: true,
    results: false,
    resultsEdit: false,
    season: false,
    ...(partial && typeof partial === "object" ? partial : {}),
  };
  if (next.resultsEdit) next.results = true;
  return next;
}

export function teamPerms(team) {
  return defaultTeamPerms(team?.perms);
}

export function canEnterPins(team, existing) {
  const perms = teamPerms(team);
  if (existing != null) return Boolean(perms.resultsEdit);
  return Boolean(perms.results || perms.resultsEdit);
}

export const ROSTER_LOCK_ROUND = 2;

export function teamRosterWindowOpen(matches, now = Date.now()) {
  const later = (matches ?? []).filter((match) => match.round >= ROSTER_LOCK_ROUND);
  if (later.length === 0) return true;
  let earliest = null;
  for (const match of later) {
    if (!match.startsAt) continue;
    const start = new Date(match.startsAt).getTime();
    if (Number.isNaN(start)) continue;
    if (earliest == null || start < earliest) earliest = start;
  }
  if (earliest != null) return now < earliest;
  return !later.some((match) =>
    (match.rounds ?? []).some((round) =>
      (round.games ?? []).some((game) => game.homePins != null || game.awayPins != null),
    ),
  );
}
