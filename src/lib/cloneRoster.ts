import { uid } from "./ids";
import { normalizePlayer } from "./playerName";
import type { Player, Team } from "./types";

/** Kopija ekip (in igralcev) za novo sezono — brez tekem/rezultatov. */
export function cloneTeamsAndPlayers(
  teams: Team[],
  players: Player[],
  selectedTeamIds: string[],
  includePlayers: boolean,
): { teams: Team[]; players: Player[] } {
  const want = new Set(selectedTeamIds);
  const nextTeams: Team[] = [];
  const idMap = new Map<string, string>();

  for (const team of teams) {
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
      // Geslo ostane — kapetan se lahko prijavi tudi v novi sezoni.
      passwordHash: team.passwordHash,
      hasAccess: Boolean(team.passwordHash) || team.hasAccess,
    });
  }

  if (!includePlayers) return { teams: nextTeams, players: [] };

  const nextPlayers: Player[] = [];
  for (const player of players) {
    const teamId = idMap.get(player.teamId);
    if (!teamId) continue;
    const n = normalizePlayer(player);
    nextPlayers.push(
      normalizePlayer({
        id: uid("p"),
        teamId,
        firstName: n.firstName,
        surname: n.surname,
        name: n.name,
        gender: n.gender,
        bzsMember: n.bzsMember,
      }),
    );
  }
  return { teams: nextTeams, players: nextPlayers };
}
