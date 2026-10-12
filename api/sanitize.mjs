export function sanitizeState(data, { admin = false, teamId = null } = {}) {
  const teams = (data?.teams ?? []).map((team) => {
    const { passwordHash, ...rest } = team;
    if (admin) return { ...rest, hasAccess: Boolean(passwordHash) };
    return rest;
  });
  let teamTrainings;
  if (admin) teamTrainings = data?.teamTrainings;
  else if (teamId) {
    teamTrainings = { [teamId]: data?.teamTrainings?.[teamId] ?? [] };
  }
  return {
    ...data,
    teams,
    teamTrainings,
    trainingSessions: admin ? data?.trainingSessions : undefined,
  };
}

export function preserveSecrets(payload, existing, opts = {}) {
  const prevTeams = existing?.teams ?? [];
  payload.teams = (payload.teams ?? []).map((team) => {
    const { passwordHash: incoming, hasAccess: _hasAccess, ...rest } = team;
    const prev = prevTeams.find((item) => item.id === team.id);
    if (opts.lockPerms) rest.perms = prev?.perms ?? rest.perms;
    if (incoming === "") return rest;
    const passwordHash = incoming || prev?.passwordHash;
    return passwordHash ? { ...rest, passwordHash } : rest;
  });
  if (payload.teamTrainings == null && existing?.teamTrainings) {
    payload.teamTrainings = existing.teamTrainings;
  }
  return payload;
}
