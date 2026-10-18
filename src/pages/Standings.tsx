import { exportStandingsPdf } from "../lib/exportPdf";
import { leagueSeasonTitle } from "../lib/fixtures";
import { computeStandings, lastCompletedRound } from "../lib/standings";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";
import { ResultHighlights } from "./ResultHighlights";

export function Standings() {
  const { state } = useStore();
  const rows = computeStandings(state);
  const round = lastCompletedRound(state);

  return (
    <>
      <header className="board-view-top">
        <div className="board-view-heading">
          <h2 className="board-view-title">Lestvica ekip</h2>
          <PdfButton label="PDF lestvice" onExport={() => exportStandingsPdf(state)} />
        </div>
        <p className="board-view-sub">
          {round > 0
            ? `${leagueSeasonTitle(state)} · po ${round}. kolu`
            : `${leagueSeasonTitle(state)} · pred začetkom`}
        </p>
        <p className="board-view-note">
          Razvrstitev: točke (zmaga 2, remi 1), male točke, podrti keglji.
        </p>
      </header>

      <div className="board-view-table-wrap">
        <table className="board-standings teams">
          <thead>
            <tr>
              <th>#</th>
              <th>Ekipa</th>
              <th>Igre</th>
              <th title="Zmag">Z</th>
              <th title="Porazov">P</th>
              <th title="Remijev">R</th>
              <th>Velike</th>
              <th>Male</th>
              <th>Povp./ekipa</th>
              <th>Povp./igralec</th>
              <th>Točke</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.team.id} className={i === 0 ? "is-lead" : undefined}>
                <td className="mono board-rank">{i + 1}</td>
                <td className="board-name">{row.team.name}</td>
                <td className="mono">{row.played}</td>
                <td className="mono">{row.won}</td>
                <td className="mono">{row.lost}</td>
                <td className="mono">{row.drawn}</td>
                <td className="mono">{row.velike}</td>
                <td className="mono">{row.small}</td>
                <td className="mono">{row.teamAvg ? row.teamAvg.toFixed(1) : "0.0"}</td>
                <td className="mono">{row.avg ? row.avg.toFixed(2) : "0.00"}</td>
                <td className="mono board-points">{row.big}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ResultHighlights scope="season" />
    </>
  );
}
