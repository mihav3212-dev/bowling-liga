import { computePlayerStandings, playersByAverage, seasonRoundCount } from "../lib/standings";
import { useStore } from "../lib/store";

export function PlayerStandings() {
  const { state } = useStore();
  const roundCount = seasonRoundCount(state);
  const players = playersByAverage(computePlayerStandings(state));
  const colSpan = 5 + roundCount;

  return (
    <section className="panel">
      <div>
        <h2 className="round-title">Lestvica igralcev</h2>
        <p className="muted">
          Keglji na tekmo, skupaj, odigrane igre in povprečje. Razvrstitev po povprečju.
        </p>
        <p className="muted players-scroll-hint">Podrsaj vodoravno za kola.</p>
      </div>
      <div className="table-scroll players-scroll">
        <table className="standings players">
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
                <td colSpan={colSpan} className="muted" style={{ textAlign: "left" }}>
                  Še ni odigranih iger.
                </td>
              </tr>
            )}
            {players.map((row, i) => (
              <tr key={row.player.id}>
                <td className="mono">{i + 1}</td>
                <td>{row.player.name}</td>
                <td>{row.teamName}</td>
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
                <td className="mono">{row.avg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
