import { afterEach, describe, expect, it } from "vitest";
import {
  dismissTvFullscreenEntry,
  isTvFullscreenEntryDismissed,
  resetTvFullscreenEntryDismissedForTests,
} from "./tvFullscreenEntry";

afterEach(() => {
  resetTvFullscreenEntryDismissedForTests();
});

describe("tvFullscreenEntry", () => {
  it("starts undismissed", () => {
    expect(isTvFullscreenEntryDismissed()).toBe(false);
  });

  it("remembers dismiss for the session", () => {
    dismissTvFullscreenEntry();
    expect(isTvFullscreenEntryDismissed()).toBe(true);
  });
});
