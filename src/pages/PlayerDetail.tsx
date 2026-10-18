import { computePlayerDetailStats } from "../lib/standings";
import { useStore } from "../lib/store";

function fmtAvg(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function PlayerDetail({
  playerId,
  onBack,
  onOpenMatch,
}: {
  playerId: string;
  onBack: () => void;
  onOpenMatch?: (matchId: string) => void;
}) {
  const { state } = useStore();
  const stats = computePlayerDetailStats(state, playerId);

  if (!stats) {
    return (
      <section className="panel">
        <button className="ghost" type="button" onClick={onBack}>
          ← Nazaj
        </button>
        <p>Igralec ne obstaja.</p>
      </section>
    );
  }

  const opponentName = (id: string) => state.players.find((p) => p.id === id)?.name ?? "—";

  return (
    <section className="panel player-detail">
      <button className="ghost" type="button" onClick={onBack}>
        ← Nazaj k ekipi
      </button>
      <h2 style={{ margin: "12px 0 4px" }}>{stats.player.name}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {stats.teamName}
        {stats.player.gender === "F" ? " · ženska (+8)" : ""}
        {stats.player.bzsMember ? " · BZS (−8)" : ""}
      </p>

      {stats.games === 0 ? (
        <p className="muted">Še ni odigranih iger v tej sezoni.</p>
      ) : (
        <>
          <div className="player-detail-summary">
            <div>
              <span className="muted">Igre</span>
              <strong className="mono">{stats.games}</strong>
            </div>
            <div>
              <span className="muted">Keglji</span>
              <strong className="mono">{stats.pins}</strong>
            </div>
            <div>
              <span className="muted">Povp.</span>
              <strong className="mono">{fmtAvg(stats.avg)}</strong>
            </div>
            <div>
              <span className="muted">Najboljša</span>
              <strong className="mono">{stats.best}</strong>
            </div>
            <div>
              <span className="muted">Male</span>
              <strong className="mono">{stats.small}</strong>
            </div>
            <div>
              <span className="muted">≥200 / 220 / 240</span>
              <strong className="mono">
                {stats.over200} / {stats.over220} / {stats.over240}
              </strong>
            </div>
          </div>

          <h3 style={{ marginTop: 28 }}>Po tekmah</h3>
          <p className="muted">Serija na tekmo (keglji po stezah) in povprečje.</p>
          <div className="table-scroll">
            <table className="player-detail-table">
              <thead>
                <tr>
                  <th>Kolo</th>
                  <th>Proti</th>
                  <th>Steze</th>
                  <th>Skupaj</th>
                  <th>Povp.</th>
                  {onOpenMatch ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {stats.matches.map((m) => (
                  <tr key={m.matchId}>
                    <td className="mono">{m.seasonRound}.</td>
                    <td>
                      {m.home ? "proti" : "@"} {m.opponentTeamName}
                    </td>
                    <td className="mono player-detail-lanes">
                      {m.games
                        .map((g) => `S${g.lane}:${g.pins}`)
                        .join(" · ")}
                    </td>
                    <td className="mono">{m.pins}</td>
                    <td className="mono">{fmtAvg(m.avg)}</td>
                    {onOpenMatch ? (
                      <td>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => onOpenMatch(m.matchId)}
                        >
                          Rezultat
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 28 }}>Po stezah</h3>
          <p className="muted">Skupaj čez sezono — koliko iger in povprečje na vsaki stezi.</p>
          <div className="table-scroll">
            <table className="player-detail-table">
              <thead>
                <tr>
                  <th>Steza</th>
                  <th>Igre</th>
                  <th>Keglji</th>
                  <th>Povp.</th>
                  <th>Naj.</th>
                </tr>
              </thead>
              <tbody>
                {stats.lanes.map((l) => (
                  <tr key={l.lane}>
                    <td className="mono">S{l.lane}</td>
                    <td className="mono">{l.games}</td>
                    <td className="mono">{l.pins}</td>
                    <td className="mono">{fmtAvg(l.avg)}</td>
                    <td className="mono">{l.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 28 }}>Vse igre</h3>
          <div className="table-scroll">
            <table className="player-detail-table">
              <thead>
                <tr>
                  <th>Kolo</th>
                  <th>Krog</th>
                  <th>Steza</th>
                  <th>Keglji</th>
                  <th>Proti igralcu</th>
                </tr>
              </thead>
              <tbody>
                {stats.matches.flatMap((m) =>
                  m.games.map((g, i) => (
                    <tr key={`${g.matchId}-${g.matchRound}-${g.lane}-${i}`}>
                      <td className="mono">{g.seasonRound}.</td>
                      <td className="mono">{g.matchRound}.</td>
                      <td className="mono">S{g.lane}</td>
                      <td className="mono">{g.pins}</td>
                      <td>{opponentName(g.opponentPlayerId)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
