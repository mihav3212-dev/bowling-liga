import { describe, expect, it } from "vitest";
import { shortTvPersonName } from "./labels";

describe("shortTvPersonName", () => {
  it("skrajša priimek + ime", () => {
    expect(shortTvPersonName("Novak David")).toBe("N. David");
    expect(shortTvPersonName("Miha Novak")).toBe("M. Novak");
  });

  it("pusti že skrajšano ali eno besedo", () => {
    expect(shortTvPersonName("N. David")).toBe("N. David");
    expect(shortTvPersonName("A1")).toBe("A1");
  });
});
