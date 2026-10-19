import type { PlayerMatchSeries } from "../lib/standings";
import { PlayerAvgChart } from "./PlayerAvgChart";

/** Graf povprečja kegljev po tekmah. */
export function PlayerMatchAvgChart({ matches }: { matches: PlayerMatchSeries[] }) {
  return (
    <PlayerAvgChart
      ariaLabel="Povprečje kegljev po tekmah"
      legendPrefix="Točke = povprečje na tekmo"
      points={matches.map((m) => ({
        id: m.matchId,
        label: `${m.seasonRound}.`,
        avg: m.avg,
        title: `${m.seasonRound}. kolo · ${m.opponentTeamName}: ${m.avg.toFixed(1)}`,
      }))}
    />
  );
}
