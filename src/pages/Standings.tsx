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
            {round > 0
              ? `LESTVICA ${leagueSeasonTitle(state)} PO ${round}. KOLU`
              : `LESTVICA ${leagueSeasonTitle(state)} · pred začetkom`}
            . Razvrstitev: TOČKE (zmaga 2, remi 1), male točke, podrti keglji.
          </p>
        </div>
        <div className="table-scroll">
          <table className="standings teams">
            <thead>
              <tr>
                <th>#</th>
                <th>Ekipa</th>
                <th>Igre</th>
                <th title="Zmag">Z</th>
                <th title="Porazov">P</th>
                <th title="Remijev">R</th>
                <th>Velike točke</th>
                <th>Male točke</th>
                <th>Povp./ekipa</th>
                <th>Povp./igralec</th>
                <th>TOČKE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.team.id}>
                  <td className="mono">{i + 1}</td>
                  <td>{row.team.name}</td>
                  <td className="mono">{row.played}</td>
                  <td className="mono">{row.won}</td>
                  <td className="mono">{row.lost}</td>
                  <td className="mono">{row.drawn}</td>
                  <td className="mono">{row.velike}</td>
                  <td className="mono">{row.small}</td>
                  <td className="mono">{row.teamAvg ? row.teamAvg.toFixed(1) : "0.0"}</td>
                  <td className="mono">{row.avg ? row.avg.toFixed(2) : "0.00"}</td>
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
