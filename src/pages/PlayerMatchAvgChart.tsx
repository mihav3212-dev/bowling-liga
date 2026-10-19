import type { PlayerMatchSeries } from "../lib/standings";

function fmtAvg(n: number): string {
  return n.toFixed(1);
}

/** Preprost graf povprečja kegljev po tekmah (brez knjižnice). */
export function PlayerMatchAvgChart({ matches }: { matches: PlayerMatchSeries[] }) {
  if (matches.length === 0) return null;

  const w = 360;
  const h = 160;
  const pad = { top: 18, right: 14, bottom: 30, left: 40 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const avgs = matches.map((m) => m.avg);
  const seasonAvg = avgs.reduce((s, n) => s + n, 0) / avgs.length;
  let yMin = Math.min(...avgs, seasonAvg);
  let yMax = Math.max(...avgs, seasonAvg);
  if (yMax - yMin < 20) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - 10;
    yMax = mid + 10;
  } else {
    const padY = (yMax - yMin) * 0.12;
    yMin -= padY;
    yMax += padY;
  }

  const xAt = (i: number) =>
    pad.left + (matches.length === 1 ? innerW / 2 : (i / (matches.length - 1)) * innerW);
  const yAt = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * innerH;

  const line = matches
    .map((m, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(m.avg).toFixed(1)}`)
    .join(" ");
  const seasonY = yAt(seasonAvg);

  const ticks = 3;
  const yTicks = Array.from({ length: ticks }, (_, i) => {
    const t = i / (ticks - 1);
    return yMin + (yMax - yMin) * (1 - t);
  });

  return (
    <div className="player-avg-chart" role="img" aria-label="Povprečje kegljev po tekmah">
      <svg viewBox={`0 0 ${w} ${h}`} className="player-avg-chart-svg" preserveAspectRatio="xMidYMid meet">
        {yTicks.map((v) => (
          <g key={v}>
            <line
              className="player-avg-chart-grid"
              x1={pad.left}
              x2={w - pad.right}
              y1={yAt(v)}
              y2={yAt(v)}
            />
            <text className="player-avg-chart-tick" x={pad.left - 6} y={yAt(v) + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line
          className="player-avg-chart-season"
          x1={pad.left}
          x2={w - pad.right}
          y1={seasonY}
          y2={seasonY}
        />
        <path className="player-avg-chart-line" d={line} fill="none" />
        {matches.map((m, i) => (
          <g key={m.matchId}>
            <circle className="player-avg-chart-dot" cx={xAt(i)} cy={yAt(m.avg)} r={4} />
            <text className="player-avg-chart-label" x={xAt(i)} y={h - 10} textAnchor="middle">
              {m.seasonRound}.
            </text>
            <title>
              {m.seasonRound}. kolo · {m.opponentTeamName}: {fmtAvg(m.avg)}
            </title>
          </g>
        ))}
      </svg>
      <p className="muted player-avg-chart-legend">
        Točke = povprečje na tekmo · črtkana = sezonsko povp. ({fmtAvg(seasonAvg)})
      </p>
    </div>
  );
}
