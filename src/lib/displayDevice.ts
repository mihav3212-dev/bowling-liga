import { useEffect, useState } from "react";

/** Način prikaza za TV/live board poglede. */
export type DisplayDevice = "phone" | "tablet" | "desktop" | "tv";

/** Samo jasni TV UA — NE SamsungBrowser (Samsung Internet na telefonih). */
const TV_UA =
  /SmartTV|SMART-TV|Web0S|WebOS|Viera|NetCast|CrKey|AppleTV|BRAVIA|HbbTV|TV Safari|(?:Tizen.*TV|TV.*Tizen)/i;

const STORAGE_KEY = "liga-display-device";

/** Kratka stranica ≤ tega = telefon (portrait in landscape). */
const PHONE_SHORT_MAX = 600;

function isDisplayDevice(v: string | null | undefined): v is DisplayDevice {
  return v === "phone" || v === "tablet" || v === "desktop" || v === "tv";
}

function readUrlOverride(): DisplayDevice | null {
  try {
    const q = new URLSearchParams(window.location.search).get("device");
    return isDisplayDevice(q) ? q : null;
  } catch {
    return null;
  }
}

function readStoredOverride(): DisplayDevice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isDisplayDevice(v) ? v : null;
  } catch {
    return null;
  }
}

function shortSide(): number {
  return Math.min(window.innerWidth || 0, window.innerHeight || 0);
}

/** Ročna izbira (gumb Telefon/TV) — ostane v localStorage. */
export function setDisplayDeviceOverride(device: DisplayDevice | null): void {
  try {
    if (device) localStorage.setItem(STORAGE_KEY, device);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  applyDisplayDevice(detectDisplayDevice());
  window.dispatchEvent(new Event("liga-display-device"));
}

function looksLikeTvUa(): boolean {
  return TV_UA.test(navigator.userAgent || "");
}

/**
 * TV pogosto: velik zaslon, grob pointer, brez hover — ampak ne tablica.
 * (iPad landscape ima hover:none + coarse, zato zahtevamo širok 16:9-ish.)
 */
function looksLikeTvEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  if (!coarse || !noHover) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const max = Math.max(w, h);
  const min = Math.min(w, h);
  if (max < 1280 || min < 700) return false;
  const ratio = max / Math.max(1, min);
  return ratio >= 1.45;
}

/**
 * Avtomatska izbira.
 * Na telefonu (kratka stranica) vedno phone — tudi če je v URL `device=tv`
 * (pogost bookmark za dvorano). Ročni gumb TV še vedno deluje prek localStorage.
 */
export function detectDisplayDevice(): DisplayDevice {
  if (typeof window === "undefined") return "desktop";

  const short = shortSide();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const long = Math.max(w, h);
  const url = readUrlOverride();
  const stored = readStoredOverride();

  if (short > 0 && short <= PHONE_SHORT_MAX) {
    // Samo eksplicitna ročna izbira na telefonu lahko vklopi TV scale.
    if (stored === "tv" || stored === "desktop") return stored;
    if (url === "phone" || url === "tablet") return url;
    return "phone";
  }

  if (url) return url;
  if (stored) return stored;
  if (looksLikeTvUa() || looksLikeTvEnvironment()) return "tv";

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (short <= 520) return "phone";
  if (short <= 600 && long <= 950) return "phone";
  if (coarse && short <= 900) return "tablet";
  if (w <= 820) return "phone";
  if (w <= 1200) return "tablet";
  return "desktop";
}

export function applyDisplayDevice(device: DisplayDevice = detectDisplayDevice()): DisplayDevice {
  document.documentElement.dataset.device = device;
  return device;
}

/** phone/tablet = fluid scroll; TV/desktop = 1080p scale stage. */
export function displayUsesScaleStage(device: DisplayDevice): boolean {
  return device === "tv" || device === "desktop";
}

/** Desktop Chrome: zoom (ostro). TV: transform (stabilno). */
export function displayPrefersCssZoom(device: DisplayDevice): boolean {
  if (device === "tv" || device === "tablet" || device === "phone") return false;
  try {
    return typeof CSS !== "undefined" && CSS.supports("zoom", "0.5");
  } catch {
    return false;
  }
}

export function useDisplayDevice(): DisplayDevice {
  const [device, setDevice] = useState<DisplayDevice>(() =>
    typeof document !== "undefined" ? applyDisplayDevice() : "desktop",
  );

  useEffect(() => {
    const sync = () => setDevice(applyDisplayDevice());
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("liga-display-device", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("liga-display-device", sync);
    };
  }, []);

  return device;
}
