import { describe, expect, it } from "vitest";
import { compactGames, gameColumnCount, scoreAverage, scoreTotal } from "./training";

describe("trening igre", () => {
  it("brez vnosov pokaže eno prazno polje, po vpisu še eno zraven", () => {
    expect(gameColumnCount([])).toBe(1);
    expect(gameColumnCount([{ playerId: "a", games: [] }])).toBe(1);
    expect(gameColumnCount([{ playerId: "a", games: [180] }])).toBe(2);
    expect(gameColumnCount([{ playerId: "a", games: [180, 200] }])).toBe(3);
  });

  it("ob shranjevanju obreže prazna polja na koncu", () => {
    expect(compactGames([180, 200, null, null])).toEqual([180, 200]);
    expect(compactGames([null, 160, null])).toEqual([null, 160]);
    expect(compactGames([null, null])).toEqual([]);
  });

  it("povprečje gre samo čez odigrane igre", () => {
    const score = { playerId: "a", games: [180, 220, null] };
    expect(scoreTotal(score)).toBe(400);
    expect(scoreAverage(score)).toBe(200);
  });
});
