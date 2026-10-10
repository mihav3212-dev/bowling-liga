import { describe, expect, it } from "vitest";
import { topPlaces, type RecapLine } from "./recap";

describe("topPlaces", () => {
  it("obdrži izenačene na 5. mestu", () => {
    const rows: RecapLine[] = [245, 241, 236, 235, 234, 234, 234, 200].map((value, i) => ({
      showRank: false,
      value,
      name: `P${i}`,
    }));
    const ranked = topPlaces(rows);
    expect(ranked.map((r) => r.value)).toEqual([245, 241, 236, 235, 234, 234, 234]);
    expect(ranked.filter((r) => r.showRank).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
