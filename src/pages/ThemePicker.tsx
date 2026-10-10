import { useEffect, useState } from "react";
import { applyTheme, readTheme, saveTheme, type ThemePref } from "../lib/theme";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  );
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemePref>(() =>
    typeof document === "undefined" ? "dark" : readTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const choose = (next: ThemePref) => {
    setTheme(next);
    saveTheme(next);
  };

  return (
    <div className="theme-picker" role="group" aria-label="Tema">
      <button
        type="button"
        className={theme === "light" ? "is-on" : ""}
        aria-label="Svetla tema"
        aria-pressed={theme === "light"}
        onClick={() => choose("light")}
      >
        <SunIcon />
      </button>
      <button
        type="button"
        className={theme === "dark" ? "is-on" : ""}
        aria-label="Temna tema"
        aria-pressed={theme === "dark"}
        onClick={() => choose("dark")}
      >
        <MoonIcon />
      </button>
    </div>
  );
}
