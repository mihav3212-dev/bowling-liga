import { maskMatchLineups } from "./lineup.mjs";
import { inviteStillOpen } from "./passwords.mjs";

export function sanitizeState(data, { admin = false, teamId = null } = {}) {
  const teams = (data?.teams ?? []).map((team) => {
    const { passwordHash, inviteHash, ...rest } = team;
    if (admin) {
      return {
        ...rest,
        hasAccess: Boolean(passwordHash),
        hasInvite: inviteStillOpen({ inviteHash, inviteExpires: rest.inviteExpires }),
      };
    }
    const { inviteExpires: _exp, hasInvite: _inv, hasAccess: _acc, ...pub } = rest;
    return pub;
  });
  let teamTrainings;
  if (admin) teamTrainings = data?.teamTrainings;
  else if (teamId) {
    teamTrainings = { [teamId]: data?.teamTrainings?.[teamId] ?? [] };
  }
  const viewer = { admin, teamId };
  const matches = (data?.matches ?? []).map((match) => maskMatchLineups(match, viewer));
  return {
    ...data,
    teams,
    matches,
    teamTrainings,
    trainingSessions: admin ? data?.trainingSessions : undefined,
  };
}

export function preserveSecrets(payload, existing, opts = {}) {
  const prevTeams = existing?.teams ?? [];
  payload.teams = (payload.teams ?? []).map((team) => {
    const { passwordHash: incoming, hasAccess: _hasAccess, hasInvite: _hasInvite, inviteHash: _ih, inviteExpires: _ie, ...rest } =
      team;
    const prev = prevTeams.find((item) => item.id === team.id);
    if (opts.lockPerms) rest.perms = prev?.perms ?? rest.perms;
    // Client saves never send invite fields (sanitized out). Server invite
    // mutations pass trustInviteFields so create/claim/clear actually stick —
    // otherwise new inviteHash is stripped and claim finds nothing.
    if (opts.trustInviteFields) {
      if (_ih) rest.inviteHash = _ih;
      if (_ie) rest.inviteExpires = _ie;
    } else {
      if (prev?.inviteHash) rest.inviteHash = prev.inviteHash;
      if (prev?.inviteExpires) rest.inviteExpires = prev.inviteExpires;
    }
    if (incoming === "") return rest;
    const passwordHash = incoming || prev?.passwordHash;
    return passwordHash ? { ...rest, passwordHash } : rest;
  });
  if (payload.teamTrainings == null && existing?.teamTrainings) {
    payload.teamTrainings = existing.teamTrainings;
  }
  return payload;
}
