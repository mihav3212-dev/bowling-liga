import { exportPlayersPdf } from "../lib/exportPdf";
import { computePlayerStandings, playersByAverage, seasonRoundCount } from "../lib/standings";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";

export function PlayerStandings() {
  const { state } = useStore();
  const roundCount = seasonRoundCount(state);
  const players = playersByAverage(computePlayerStandings(state));
  const colSpan = 5 + roundCount;

  return (
    <>
      <header className="board-view-top">
        <div className="board-view-heading">
          <h2 className="board-view-title">Lestvica igralcev</h2>
          <PdfButton label="PDF igralcev" onExport={() => exportPlayersPdf(state)} />
        </div>
        <p className="board-view-sub">Razvrstitev po povprečju kegljev</p>
        <p className="board-view-note">Keglji na tekmo, skupaj, odigrane igre in povprečje.</p>
        <p className="board-view-note board-view-scroll-hint">Podrsaj vodoravno za kola.</p>
      </header>

      <div className="board-view-table-wrap players-scroll">
        <table className="board-standings players">
          <thead>
            <tr>
              <th>#</th>
              <th>Igralec</th>
              <th>Ekipa</th>
              {Array.from({ length: roundCount }, (_, i) => (
                <th key={i} className="kolo">
                  {i + 1}
                </th>
              ))}
              <th>Keglji</th>
              <th>Igre</th>
              <th>Povp.</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="board-empty">
                  Še ni odigranih iger.
                </td>
              </tr>
            )}
            {players.map((row, i) => (
              <tr key={row.player.id} className={i === 0 ? "is-lead" : undefined}>
                <td className="mono board-rank">{i + 1}</td>
                <td className="board-name">{row.player.name}</td>
                <td className="board-team">{row.teamName}</td>
                {row.byRound.map((games, ri) => {
                  const pins = games.reduce((sum, n) => sum + n, 0);
                  return (
                    <td key={ri} className="mono kolo">
                      {games.length ? pins : "—"}
                    </td>
                  );
                })}
                <td className="mono">{row.pins}</td>
                <td className="mono">{row.games}</td>
                <td className="mono board-points">{row.avg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
