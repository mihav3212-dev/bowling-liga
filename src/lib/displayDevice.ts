import { useEffect, useState } from "react";

/** Način prikaza za TV/live board poglede. */
export type DisplayDevice = "phone" | "tablet" | "desktop" | "tv";

const TV_UA =
  /Tizen|SmartTV|SMART-TV|SamsungBrowser|Web0S|WebOS|Viera|NetCast|CrKey|AppleTV|BRAVIA|HbbTV|TV Safari/i;

function readOverride(): DisplayDevice | null {
  try {
    const q = new URLSearchParams(window.location.search).get("device");
    if (q === "phone" || q === "tablet" || q === "desktop" || q === "tv") return q;
  } catch {
    /* ignore */
  }
  return null;
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

/** Avtomatska izbira: override URL → TV UA/okolje → širina okna. */
export function detectDisplayDevice(): DisplayDevice {
  if (typeof window === "undefined") return "desktop";
  const override = readOverride();
  if (override) return override;
  if (looksLikeTvUa() || looksLikeTvEnvironment()) return "tv";
  const w = window.innerWidth;
  if (w <= 820) return "phone";
  if (w <= 1200) return "tablet";
  return "desktop";
}

export function applyDisplayDevice(device: DisplayDevice = detectDisplayDevice()): DisplayDevice {
  document.documentElement.dataset.device = device;
  return device;
}

/** phone = fluid scroll; ostali = 1080p scale stage. */
export function displayUsesScaleStage(device: DisplayDevice): boolean {
  return device !== "phone";
}

/** Desktop Chrome: zoom (ostro). TV/tablet: transform (stabilno). */
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
    return () => window.removeEventListener("resize", sync);
  }, []);

  return device;
}
