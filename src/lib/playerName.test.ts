import { describe, expect, it } from "vitest";
import { sortTeamRoster } from "./playerName";
import type { Player } from "./types";

function p(partial: Partial<Player> & Pick<Player, "id" | "firstName" | "surname">): Player {
  return {
    teamId: "t1",
    gender: "M",
    bzsMember: false,
    name: `${partial.surname} ${partial.firstName}`.trim(),
    ...partial,
  };
}

describe("sortTeamRoster", () => {
  it("abeceda po priimku, vodja prvi", () => {
    const list = sortTeamRoster(
      [
        p({ id: "1", firstName: "ANA", surname: "ŽAGAR" }),
        p({ id: "2", firstName: "MIHA", surname: "NOVAK" }),
        p({ id: "3", firstName: "PETRA", surname: "BREZNIK" }),
      ],
      "Miha Novak",
    );
    expect(list.map((x) => x.id)).toEqual(["2", "3", "1"]);
  });
});
