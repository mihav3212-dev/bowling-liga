import { describe, expect, it } from "vitest";
import { shortTvPersonName } from "./labels";
import {
  composePlayerName,
  normalizePlayer,
  shortTvPersonNameFromParts,
  splitPlayerName,
} from "./playerName";

describe("splitPlayerName", () => {
  it("razcepi ime + priimek", () => {
    expect(splitPlayerName("Miha Novak")).toEqual({ firstName: "Miha", surname: "Novak" });
    expect(splitPlayerName("Ana Maria Horvat")).toEqual({
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
    expect(shortTvPersonName("Miha Novak")).toBe("Miha N.");
    expect(shortTvPersonNameFromParts("Miha", "Novak")).toBe("Miha N.");
  });

  it("obdela že skrajšano ime ali eno besedo", () => {
    expect(shortTvPersonName("M. Novak")).toBe("M. N.");
    expect(shortTvPersonName("A1")).toBe("A1");
  });
});

describe("normalizePlayer", () => {
  it("dopolni firstName/surname iz name", () => {
    const p = normalizePlayer({
      id: "p1",
      teamId: "t1",
      name: "Miha Novak",
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
