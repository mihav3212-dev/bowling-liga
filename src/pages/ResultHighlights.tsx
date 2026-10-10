import { computeWeekRecap, recapHasData, type RecapLine } from "../lib/recap";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

function sliceRound(state: LeagueState, round: number): LeagueState {
  return { ...state, matches: state.matches.filter((m) => m.round === round) };
}

function Line({ line }: { line: RecapLine }) {
  return (
    <li>
      <span>
        {line.showRank && line.rank != null ? `${line.rank}. ` : ""}
        <span className="mono">{line.value}</span> {line.name}
        {line.team ? ` (${line.team})` : ""}
      </span>
    </li>
  );
}

function Head({ title, lines }: { title: string; lines: RecapLine[] }) {
  return (
    <div className="recap-head">
      <span>{title}</span>
      <span className="recap-head-value">
        {lines.length === 0
          ? "—"
          : lines.map((line, i) => (
              <span key={`${line.name}-${line.value}`}>
                {i > 0 ? <br /> : null}
                <span className="mono">{line.value}</span>
                {` — ${line.name}`}
                {line.team ? ` (${line.team})` : ""}
              </span>
            ))}
      </span>
    </div>
  );
}

function RecapBody({ state }: { state: LeagueState }) {
  const recap = computeWeekRecap(state);
  if (!recapHasData(recap)) return null;
  return (
    <div className="week-recap">
      <Head title="Največ kegljev — posamezno:" lines={recap.bestSingle} />
      <Head title="Najboljša igra — skupaj:" lines={recap.bestSeries} />
      <Head title="Največ kegljev — ekipno:" lines={recap.bestTeam} />
      <div className="stat-block">
        <h3>Lestvica TOP 5 — posamezna igra</h3>
        <ol>
          {recap.topSingles.map((line) => (
            <Line key={`s-${line.name}-${line.value}-${line.rank}`} line={line} />
          ))}
        </ol>
      </div>
      <div className="stat-block">
        <h3>Lestvica TOP 5 — posamezno 4 igre</h3>
        <ol>
          {recap.topSeries.map((line) => (
            <Line key={`q-${line.name}-${line.value}-${line.rank}`} line={line} />
          ))}
        </ol>
      </div>
      <div className="stat-block">
        <h3>Lestvica TOP 5 — največ kegljev po igri ekipa</h3>
        <ol>
          {recap.topTeams.map((line) => (
            <Line key={`t-${line.name}-${line.value}-${line.rank}`} line={line} />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ResultHighlights({
  scope,
  round,
  state: given,
}: {
  scope: "season" | "round";
  round?: number;
  state?: LeagueState;
}) {
  const store = useStore();
  const state = given ?? store.state;
  const data = scope === "round" && round ? sliceRound(state, round) : state;
  const title =
    scope === "round" && round
      ? `Najboljši rezultati ${round}. kola`
      : "Najboljši rezultati sezone";

  return (
    <section className={`standings-extras${scope === "round" ? " round-highlights" : " panel"}`}>
      {scope === "season" && <h2 className="round-title">{title}</h2>}
      {scope === "round" && <h3 className="recap-title">{title}</h3>}
      <RecapBody state={data} />
    </section>
  );
}
