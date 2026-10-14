import { describe, expect, it } from "vitest";
import { formatInviteCode, looksLikeInviteCode, normalizeInviteToken, newInviteToken } from "./invite";

describe("invite codes", () => {
  it("normalizes spacing and case", () => {
    expect(normalizeInviteToken(" ab3k-9m2p ")).toBe("AB3K9M2P");
    expect(formatInviteCode("ab3k9m2p")).toBe("AB3K-9M2P");
  });

  it("makes short readable tokens", () => {
    const token = newInviteToken();
    expect(token).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(token).not.toMatch(/[IO01]/);
    expect(looksLikeInviteCode(token)).toBe(true);
    expect(looksLikeInviteCode("moje-geslo")).toBe(false);
  });
});

