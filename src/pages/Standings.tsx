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
            . Razvrstitev: velike točke (zmaga 2, remi 1), male točke, podrti keglji.
          </p>
        </div>
        <div className="table-scroll">
          <table className="standings teams">
            <thead>
              <tr>
                <th>#</th>
                <th>Ekipa</th>
                <th>Točk</th>
                <th>Zmag</th>
                <th>Porazov</th>
                <th>Remijev</th>
                <th>Malih točk</th>
                <th>Podrtih kegljev</th>
                <th>Povp./igro</th>
                <th>Velike točke</th>
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
                  <td className="mono">{row.small}</td>
                  <td className="mono">{row.pins}</td>
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
