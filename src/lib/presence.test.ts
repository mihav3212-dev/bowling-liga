import { describe, expect, it } from "vitest";
import { presenceKind, presenceSummary } from "./presence";

describe("presenceKind", () => {
  it("TV zaslon in liga tabla sta TV", () => {
    expect(presenceKind("?display=live")).toBe("tv");
    expect(presenceKind("display=board")).toBe("tv");
  });

  it("lestvica ekip in igralcev gresta skupaj", () => {
    expect(presenceKind("?page=standings")).toBe("standings");
    expect(presenceKind("?page=players")).toBe("standings");
  });

  it("rezultati ostanejo svoja skupina", () => {
    expect(presenceKind("?page=results&match=m1")).toBe("results");
  });

  it("razpored in predogledi niso TV", () => {
    expect(presenceKind("")).toBe("other");
    expect(presenceKind("?page=schedule")).toBe("other");
    expect(presenceKind("?display=preview")).toBe("other");
  });
});

describe("presenceSummary", () => {
  it("pokaže tri skupine in ostalo samo, ko je kdo tam", () => {
    expect(presenceSummary({ total: 14, tv: 8, standings: 4, results: 2, other: 0 })).toBe(
      "8 TV · 4 lestvica · 2 rezultati",
    );
    expect(presenceSummary({ total: 3, tv: 1, standings: 0, results: 0, other: 2 })).toBe(
      "1 TV · 0 lestvica · 0 rezultati · 2 ostalo",
    );
  });
});
