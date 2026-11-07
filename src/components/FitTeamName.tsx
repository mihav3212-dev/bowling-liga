import { Fragment, useLayoutEffect, useRef, type CSSProperties } from "react";

/**
 * Vsaka beseda v svoji vrstici; velikost se prilagodi najdaljši besedi
 * (brez lomljenja sredi besede).
 */
export function FitTeamName({
  name,
  className,
  wordClassName = "fit-team-name-word",
  neonLetters = false,
  maxFontPx,
  minFontPx = 12,
  widthFactor = 0.28,
}: {
  name: string;
  className?: string;
  wordClassName?: string;
  /** Vsaka črka v svojem spanu — za neon obrobo. */
  neonLetters?: boolean;
  /** Zgornja meja velikosti; če ni podana, iz širine stolpca. */
  maxFontPx?: number;
  minFontPx?: number;
  widthFactor?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = name.trim().split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;

    const fit = () => {
      const fromWidth = Math.max(20, box.clientWidth * widthFactor);
      const ceiling = maxFontPx != null ? maxFontPx : Math.min(52, fromWidth);
      const maxPx = Math.min(ceiling, fromWidth);
      let size = Math.max(minFontPx, maxPx);
      el.style.fontSize = `${size}px`;
      while (size > minFontPx && el.scrollWidth > box.clientWidth + 1) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [name, maxFontPx, minFontPx, widthFactor, neonLetters]);

  return (
    <h1 ref={ref} className={className}>
      {words.map((word, i) => {
        const chars = Array.from(word);
        const last = Math.max(1, chars.length - 1);
        return (
          <Fragment key={`${i}-${word}`}>
            {i > 0 ? <br /> : null}
            <span className={wordClassName}>
              {neonLetters
                ? chars.map((ch, j) => (
                    <span
                      key={`${i}-${j}`}
                      className="neon-letter"
                      style={{ "--neon-t": String(j / last) } as CSSProperties}
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
