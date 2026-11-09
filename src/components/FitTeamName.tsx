import { Fragment, useLayoutEffect, useRef, type CSSProperties } from "react";

type FitGroupMember = {
  ideal: number;
  scale: number;
  apply: (px: number) => void;
};

const fitGroups = new Map<string, Map<object, FitGroupMember>>();

function publishFit(groupId: string, key: object, member: FitGroupMember) {
  let group = fitGroups.get(groupId);
  if (!group) {
    group = new Map();
    fitGroups.set(groupId, group);
  }
  group.set(key, member);
  let base = Infinity;
  for (const m of group.values()) base = Math.min(base, m.ideal);
  if (!Number.isFinite(base)) return;
  for (const m of group.values()) m.apply(base * m.scale);
}

function leaveFitGroup(groupId: string, key: object) {
  const group = fitGroups.get(groupId);
  if (!group) return;
  group.delete(key);
  if (group.size === 0) fitGroups.delete(groupId);
}

/**
 * Vsaka beseda v svoji vrstici; velikost se prilagodi najdaljši besedi
 * (brez lomljenja sredi besede).
 */
export function FitTeamName({
  name,
  className,
  wordClassName = "fit-team-name-word",
  neonLetters = false,
  neonTone = "cyan",
  maxFontPx,
  minFontPx = 12,
  widthFactor = 0.28,
  fitGroup,
  sizeScale = 1,
}: {
  name: string;
  className?: string;
  wordClassName?: string;
  /** Vsaka črka v svojem spanu — za neon obrobo. */
  neonLetters?: boolean;
  /** Enobarvni neon: cyan = domači, magenta = gostje. */
  neonTone?: "cyan" | "magenta";
  /** Zgornja meja velikosti; če ni podana, iz širine stolpca. */
  maxFontPx?: number;
  minFontPx?: number;
  widthFactor?: number;
  /** Skupina: isto osnovno velikost (min fit), nato sizeScale. */
  fitGroup?: string;
  /** Npr. 1.12 za zmagovalca. */
  sizeScale?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const memberKey = useRef<object>({});
  const words = name.trim().split(/\s+/).filter(Boolean);
  const neonT = neonTone === "magenta" ? "1" : "0";

  useLayoutEffect(() => {
    const el = ref.current;
    const box =
      el?.closest(".result-view-side, .live-tv-side, .live-quad-mid-label") ?? el?.parentElement;
    if (!el || !box) return;

    const key = memberKey.current;

    const widestLine = () => {
      const lines = el.querySelectorAll(":scope > span");
      if (lines.length === 0) return el.scrollWidth;
      let widest = 0;
      for (const line of lines) {
        const node = line as HTMLElement;
        const prev = node.style.display;
        node.style.display = "inline-block";
        widest = Math.max(widest, node.scrollWidth);
        node.style.display = prev;
      }
      return widest;
    };

    const fit = () => {
      const scale = sizeScale > 0 ? sizeScale : 1;
      const fromWidth = Math.max(20, box.clientWidth * widthFactor);
      const baseCeiling = maxFontPx != null ? maxFontPx : Math.min(52, fromWidth);
      // sizeScale je že v merjeni velikosti, da zmagovalec ne zleze čez stolpec.
      const maxDisplay = Math.min(baseCeiling, fromWidth) * scale;

      // Merimo brez neon obrobe. Italic ostane, da zmagovalec ne zleze čez rob.
      el.classList.add("is-fitting");

      let size = Math.max(minFontPx, maxDisplay);
      el.style.fontSize = `${size}px`;
      const limit = Math.max(1, box.clientWidth - 6);
      while (size > minFontPx && widestLine() > limit + 1) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }

      el.classList.remove("is-fitting");

      if (fitGroup) {
        publishFit(fitGroup, key, {
          ideal: size / scale,
          scale,
          apply: (px) => {
            el.style.fontSize = `${px}px`;
          },
        });
      } else {
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => {
      ro.disconnect();
      if (fitGroup) leaveFitGroup(fitGroup, key);
    };
  }, [name, maxFontPx, minFontPx, widthFactor, neonLetters, neonTone, fitGroup, sizeScale]);

  return (
    <h1 ref={ref} className={className}>
      {words.map((word, i) => {
        const chars = Array.from(word);
        return (
          <Fragment key={`${i}-${word}`}>
            {i > 0 ? <br /> : null}
            <span className={wordClassName}>
              {neonLetters
                ? chars.map((ch, j) => (
                    <span
                      key={`${i}-${j}`}
                      className="neon-letter"
                      style={{ "--neon-t": neonT } as CSSProperties}
                    >
                      {ch}
                    </span>
                  ))
                : word}
            </span>
          </Fragment>
        );
      })}
    </h1>
  );
}
