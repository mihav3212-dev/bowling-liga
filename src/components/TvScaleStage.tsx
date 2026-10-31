import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import {
  displayPrefersCssZoom,
  displayUsesScaleStage,
  useDisplayDevice,
  type DisplayDevice,
} from "../lib/displayDevice";

/** Referenčna TV kompozicija (Full HD). */
export const TV_DESIGN_W = 1920;
export const TV_DESIGN_H = 1080;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as RefObject<T | null>).current = value;
}

type Props = {
  children: ReactNode;
  /** Shell element (za fullscreen). */
  shellRef?: Ref<HTMLDivElement | null>;
  /**
   * Če ni podano, se vklopi avtomatsko glede na napravo
   * (phone = fluid, ostalo = 1920×1080 scale).
   */
  enabled?: boolean;
  className?: string;
};

/**
 * TV lupina: sama izbere način glede na telefon / tablico / desktop / TV.
 * Platno 1920×1080 + scale-to-fit (zoom na desktopu, transform na TV).
 */
export function TvScaleStage({
  children,
  shellRef,
  enabled,
  className = "",
}: Props) {
  const device = useDisplayDevice();
  const scaleOn = enabled ?? displayUsesScaleStage(device);
  const useZoom = displayPrefersCssZoom(device);
  const localShell = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const setShell = (node: HTMLDivElement | null) => {
    localShell.current = node;
    assignRef(shellRef, node);
  };

  useLayoutEffect(() => {
    if (!scaleOn) return;
    const shell = localShell.current;
    const stage = stageRef.current;
    if (!shell || !stage) return;

    const fit = () => {
      const sw = shell.clientWidth;
      const sh = shell.clientHeight;
      if (sw <= 0 || sh <= 0) return;
      const scale = Math.min(sw / TV_DESIGN_W, sh / TV_DESIGN_H);

      stage.style.width = `${TV_DESIGN_W}px`;
      stage.style.height = `${TV_DESIGN_H}px`;

      if (Math.abs(scale - 1) < 0.001) {
        stage.style.zoom = "";
        stage.style.transform = "";
        return;
      }

      if (useZoom) {
        stage.style.zoom = String(scale);
        stage.style.transform = "";
      } else {
        stage.style.zoom = "";
        stage.style.transform = `scale(${scale})`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(shell);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [scaleOn, useZoom, device]);

  const deviceClass = `is-device-${device as DisplayDevice}`;

  if (!scaleOn) {
    return (
      <div
        ref={setShell}
        className={`tv-scale-shell is-fluid ${deviceClass}${className ? ` ${className}` : ""}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setShell}
      className={`tv-scale-shell is-scaled ${deviceClass}${className ? ` ${className}` : ""}`}
    >
      <div ref={stageRef} className="tv-scale-stage">
        {children}
      </div>
    </div>
  );
}
