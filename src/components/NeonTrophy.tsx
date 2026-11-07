/**
 * Znak zmagovalca — tvoj neon pokal iz `public/winner-trophy.png`.
 * Zamenjaj datoteko, če želiš drugo različico.
 */
/** Cache-bust when asset is replaced. */
export const WINNER_TROPHY_SRC = "/winner-trophy.png?v=4";

export function NeonTrophy({ className = "" }: { className?: string }) {
  return (
    <span className={`neon-trophy${className ? ` ${className}` : ""}`} aria-hidden>
      <img
        className="neon-trophy-img"
        src={WINNER_TROPHY_SRC}
        alt=""
        width={256}
        height={256}
        decoding="async"
      />
    </span>
  );
}
