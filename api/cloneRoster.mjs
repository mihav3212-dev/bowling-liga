function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Kopija ekip (+ igralcev) za novo sezono, z gesli. */
export function cloneTeamsAndPlayers(teams, players, selectedTeamIds, includePlayers) {
  const want = new Set(selectedTeamIds ?? []);
  const nextTeams = [];
  const idMap = new Map();

  for (const team of teams ?? []) {
    if (!want.has(team.id)) continue;
    const id = uid("t");
    idMap.set(team.id, id);
    nextTeams.push({
      id,
      name: team.name,
      captain: team.captain,
      phone: team.phone,
      email: team.email,
      perms: team.perms ? { ...team.perms } : undefined,
      passwordHash: team.passwordHash,
    });
  }

  if (!includePlayers) return { teams: nextTeams, players: [] };

  const nextPlayers = [];
  for (const player of players ?? []) {
    const teamId = idMap.get(player.teamId);
    if (!teamId) continue;
    nextPlayers.push({
      id: uid("p"),
      teamId,
      name: player.name,
      gender: player.gender === "F" ? "F" : "M",
      bzsMember: Boolean(player.bzsMember),
    });
  }
  return { teams: nextTeams, players: nextPlayers };
}
