/** Session key: after dismiss, ne kaži znova v istih zavihkih. */
export const TV_FS_ENTRY_SESSION_KEY = "bowling-liga:tv-fs-entry-dismissed";

/** Fallback, če sessionStorage ni na voljo (zasebni način). */
let memoryDismissed = false;

export function isTvFullscreenEntryDismissed(): boolean {
  if (memoryDismissed) return true;
  try {
    return sessionStorage.getItem(TV_FS_ENTRY_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissTvFullscreenEntry(): void {
  memoryDismissed = true;
  try {
    sessionStorage.setItem(TV_FS_ENTRY_SESSION_KEY, "1");
  } catch {
    // zasebni način / blokiran storage
  }
}

/** Samo za teste. */
export function resetTvFullscreenEntryDismissedForTests(): void {
  memoryDismissed = false;
  try {
    sessionStorage.removeItem(TV_FS_ENTRY_SESSION_KEY);
  } catch {
    // ignore
  }
}
