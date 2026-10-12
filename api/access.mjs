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
