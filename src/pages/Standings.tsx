import { leagueSeasonTitle } from "../lib/fixtures";
import { computeStandings, lastCompletedRound } from "../lib/standings";
import { useStore } from "../lib/store";
import { ResultHighlights } from "./ResultHighlights";

export function Standings() {
  const { state } = useStore();
  const rows = computeStandings(state);
  const round = lastCompletedRound(state);

  return (
    <>
      <section className="panel">
        <div>
          <h2 className="round-title">Lestvica ekip</h2>
          <p className="muted">
            Sezona {leagueSeasonTitle(state)}
            {round > 0 ? ` · po ${round}. kolu` : " · pred začetkom"}.
            Razvrstitev: točke ekipe (zmaga 2, remi 1), male točke, podrti keglji.
          </p>
        </div>
        <div className="table-scroll">
          <table className="standings teams">
            <thead>
              <tr>
                <th>#</th>
                <th>Ekipa</th>
                <th>T</th>
                <th>Z</th>
                <th>N</th>
                <th>P</th>
                <th>Male</th>
                <th>Keglji</th>
                <th>Točke</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.team.id}>
                  <td className="mono">{i + 1}</td>
                  <td>{row.team.name}</td>
                  <td className="mono">{row.played}</td>
                  <td className="mono">{row.won}</td>
                  <td className="mono">{row.drawn}</td>
                  <td className="mono">{row.lost}</td>
                  <td className="mono">{row.small}</td>
                  <td className="mono">{row.pins}</td>
                  <td className="mono">{row.big}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ResultHighlights scope="season" />
    </>
  );
}
