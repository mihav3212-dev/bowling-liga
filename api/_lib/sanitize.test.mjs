import { describe, expect, it } from "vitest";
import { findInviteTeam, hashInviteToken, newInviteToken } from "./passwords.mjs";
import { preserveSecrets } from "./sanitize.mjs";

describe("preserveSecrets invite fields", () => {
  const existing = {
    teams: [{ id: "t1", name: "Aces", passwordHash: "salt:old" }],
  };

  it("keeps existing invite on client save (no invite in payload)", () => {
    const prevHash = hashInviteToken("ABCD1234");
    const withInvite = {
      teams: [{ id: "t1", name: "Aces", passwordHash: "salt:old", inviteHash: prevHash, inviteExpires: "2099-01-01T00:00:00.000Z" }],
    };
    const clientPayload = {
      teams: [{ id: "t1", name: "Aces Renamed", hasAccess: true, hasInvite: true }],
    };
    const saved = preserveSecrets(structuredClone(clientPayload), withInvite);
    expect(saved.teams[0].inviteHash).toBe(prevHash);
    expect(saved.teams[0].inviteExpires).toBe("2099-01-01T00:00:00.000Z");
    expect(saved.teams[0].name).toBe("Aces Renamed");
    expect(saved.teams[0].passwordHash).toBe("salt:old");
    expect(saved.teams[0].hasInvite).toBeUndefined();
  });

  it("persists a newly created invite when trustInviteFields is set", () => {
    const token = newInviteToken();
    const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();
    const payload = {
      teams: [
        {
          id: "t1",
          name: "Aces",
          passwordHash: "salt:old",
          inviteHash: hashInviteToken(token),
          inviteExpires: expiresAt,
        },
      ],
    };
    const stripped = preserveSecrets(structuredClone(payload), existing);
    expect(stripped.teams[0].inviteHash).toBeUndefined();
    expect(findInviteTeam(stripped.teams, token)).toBeNull();

    const saved = preserveSecrets(structuredClone(payload), existing, { trustInviteFields: true });
    expect(saved.teams[0].inviteHash).toBe(hashInviteToken(token));
    expect(saved.teams[0].inviteExpires).toBe(expiresAt);
    expect(findInviteTeam(saved.teams, token)?.id).toBe("t1");
  });

  it("clears invite on claim/setPassword when trustInviteFields is set", () => {
    const token = newInviteToken();
    const prev = {
      teams: [
        {
          id: "t1",
          name: "Aces",
          passwordHash: "salt:old",
          inviteHash: hashInviteToken(token),
          inviteExpires: "2099-01-01T00:00:00.000Z",
        },
      ],
    };
    const claimed = {
      teams: [{ id: "t1", name: "Aces", passwordHash: "newsalt:newhash" }],
    };
    const withoutFlag = preserveSecrets(structuredClone(claimed), prev);
    expect(withoutFlag.teams[0].inviteHash).toBe(hashInviteToken(token));

    const cleared = preserveSecrets(structuredClone(claimed), prev, { trustInviteFields: true });
    expect(cleared.teams[0].inviteHash).toBeUndefined();
    expect(cleared.teams[0].inviteExpires).toBeUndefined();
    expect(cleared.teams[0].passwordHash).toBe("newsalt:newhash");
    expect(findInviteTeam(cleared.teams, token)).toBeNull();
  });
});
