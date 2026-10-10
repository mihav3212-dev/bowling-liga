export type ThemePref = "light" | "dark";

const KEY = "bowling-liga-theme";

export function readTheme(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "light") return "light";
  } catch {
    /* ignore */
  }
  return "dark";
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = pref;
  document.documentElement.style.colorScheme = pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", pref === "dark" ? "#000000" : "#ffffff");
}

export function saveTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}
