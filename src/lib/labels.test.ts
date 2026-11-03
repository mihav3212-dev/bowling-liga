import { describe, expect, it } from "vitest";
import { shortTvPersonName } from "./labels";
import {
  composePlayerName,
  normalizeLeagueState,
  normalizePlayer,
  shortTvPersonNameFromParts,
  splitPlayerName,
} from "./playerName";

describe("splitPlayerName", () => {
  it("razcepi priimek + ime", () => {
    expect(splitPlayerName("Novak Miha")).toEqual({ firstName: "Miha", surname: "Novak" });
    expect(splitPlayerName("Horvat Ana Maria")).toEqual({
      firstName: "Ana Maria",
      surname: "Horvat",
    });
  });

  it("obdela začetnico", () => {
    expect(splitPlayerName("M. Novak")).toEqual({ firstName: "M.", surname: "Novak" });
  });
});

describe("composePlayerName", () => {
  it("združi priimek + ime", () => {
    expect(composePlayerName("Miha", "Novak")).toBe("Novak Miha");
  });
});

describe("shortTvPersonName", () => {
  it("ime polno, priimek začetnica", () => {
    expect(shortTvPersonName("Novak Miha")).toBe("Miha N.");
    expect(shortTvPersonNameFromParts("Miha", "Novak")).toBe("Miha N.");
  });

  it("obdela že skrajšano ime ali eno besedo", () => {
    expect(shortTvPersonName("M. Novak")).toBe("M. N.");
    expect(shortTvPersonName("A1")).toBe("A1");
  });
});

describe("normalizePlayer", () => {
  it("dopolni firstName/surname iz name (priimek ime)", () => {
    const p = normalizePlayer({
      id: "p1",
      teamId: "t1",
      name: "Novak Miha",
      gender: "M",
      bzsMember: false,
      firstName: "",
      surname: "",
    });
    expect(p.firstName).toBe("MIHA");
    expect(p.surname).toBe("NOVAK");
    expect(p.name).toBe("NOVAK MIHA");
  });
});

describe("normalizeLeagueState name schema", () => {
  it("enkrat zamenja obrnjena firstName/surname polja", () => {
    const once = normalizeLeagueState({
      playerNameSchema: 1,
      players: [
        {
          id: "p1",
          teamId: "t1",
          firstName: "HOJS",
          surname: "SVEN",
          name: "SVEN HOJS",
          gender: "M" as const,
          bzsMember: false,
        },
      ],
    });
    expect(once.players[0]?.firstName).toBe("SVEN");
    expect(once.players[0]?.surname).toBe("HOJS");
    expect(once.players[0]?.name).toBe("HOJS SVEN");
    expect(once.playerNameSchema).toBe(2);

    const twice = normalizeLeagueState(once);
    expect(twice.players[0]?.firstName).toBe("SVEN");
    expect(twice.players[0]?.surname).toBe("HOJS");
  });
});
