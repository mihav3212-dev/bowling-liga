import {
  computePlayerStandings,
  computeStandings,
  lastCompletedRound,
  playersByAverage,
  playersByHighs,
  teamsByHighs,
  topGames,
} from "../lib/standings";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

function StatList({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: string }[];
}) {
  return (
    <div className="stat-block">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={`${title}-${item.name}-${item.value}`}>
              <span>{item.name}</span>
              <span className="mono">{item.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function sliceRound(state: LeagueState, round: number): LeagueState {
  return { ...state, matches: state.matches.filter((m) => m.round === round) };
}

export function ResultHighlights({
  scope,
}: {
  scope: "season" | "round";
}) {
  const { state } = useStore();
  const round = lastCompletedRound(state);
  if (scope === "round" && round === 0) return null;

  const data = scope === "round" ? sliceRound(state, round) : state;
  const rows = computeStandings(data);
  const players = computePlayerStandings(data);
  const highs = topGames(data, 8);
  const title =
    scope === "round" ? `Najboljši rezultati ${round}. kola` : "Najboljši rezultati sezone";

  return (
    <section className={`panel standings-extras${scope === "round" ? " round-highlights" : ""}`}>
      <h2 className="round-title">{title}</h2>
      <div className="grid-2">
        <div>
          <StatList
            title="Največ iger nad 200 — ekipe"
            items={teamsByHighs(rows, "over200")
              .slice(0, 8)
              .map((row) => ({ name: row.team.name, value: String(row.over200) }))}
          />
          <StatList
            title="Največ iger nad 220 — ekipe"
            items={teamsByHighs(rows, "over220")
              .slice(0, 8)
              .map((row) => ({ name: row.team.name, value: String(row.over220) }))}
          />
          <StatList
            title="Največ iger nad 240 — ekipe"
            items={teamsByHighs(rows, "over240")
              .slice(0, 8)
              .map((row) => ({ name: row.team.name, value: String(row.over240) }))}
          />
        </div>
        <div>
          <StatList
            title="Najvišji rezultati"
            items={highs.map((game) => ({
              name: `${game.playerName} (${game.teamName})`,
              value: String(game.pins),
            }))}
          />
          <StatList
            title="Največ iger nad 200 — igralci"
            items={playersByHighs(players, "over200")
              .slice(0, 5)
              .map((row) => ({
                name: `${row.player.name} (${row.teamName})`,
                value: String(row.over200),
              }))}
          />
          <StatList
            title="Največ iger nad 220 — igralci"
            items={playersByHighs(players, "over220")
              .slice(0, 5)
              .map((row) => ({
                name: `${row.player.name} (${row.teamName})`,
                value: String(row.over220),
              }))}
          />
          <StatList
            title="Največ iger nad 240 — igralci"
            items={playersByHighs(players, "over240")
              .slice(0, 5)
              .map((row) => ({
                name: `${row.player.name} (${row.teamName})`,
                value: String(row.over240),
              }))}
          />
          <StatList
            title="TOP 5 — male točke"
            items={players.slice(0, 5).map((row) => ({
              name: `${row.player.name} (${row.teamName})`,
              value: String(row.points),
            }))}
          />
          <StatList
            title="TOP 5 — povprečje"
            items={playersByAverage(players)
              .slice(0, 5)
              .map((row) => ({
                name: `${row.player.name} (${row.teamName})`,
                value: row.avg.toFixed(1),
              }))}
          />
        </div>
      </div>
    </section>
  );
}
