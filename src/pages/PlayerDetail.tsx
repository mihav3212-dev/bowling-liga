import { computePlayerDetailStats } from "../lib/standings";
import { computePlayerTrainingStats } from "../lib/training";
import { useStore } from "../lib/store";
import { PlayerAvgChart } from "./PlayerAvgChart";
import { PlayerMatchAvgChart } from "./PlayerMatchAvgChart";

function fmtAvg(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
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
  const training = computePlayerTrainingStats(state, playerId);

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

  const hasMatch = stats.games > 0;
  const hasTraining = Boolean(training && training.games > 0);
  const delta =
    hasMatch && hasTraining && training ? training.avg - stats.avg : null;

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

      {!hasMatch && !hasTraining ? (
        <p className="muted">Še ni odigranih iger ali treningov v tej sezoni.</p>
      ) : (
        <>
          {hasMatch && hasTraining && training && (
            <p className="player-compare-line">
              <span className="muted">Primerjava povprečij:</span>{" "}
              <strong className="mono">tekme {fmtAvg(stats.avg)}</strong>
              <span className="muted"> · </span>
              <strong className="mono">trening {fmtAvg(training.avg)}</strong>
              {delta != null && (
                <>
                  <span className="muted"> · </span>
                  <strong className={`mono ${delta >= 0 ? "is-up" : "is-down"}`}>
                    {delta >= 0 ? "+" : ""}
                    {fmtAvg(delta)}
                  </strong>
                  <span className="muted"> (trening − tekma)</span>
                </>
              )}
            </p>
          )}

          {hasMatch && (
            <>
              <h3 style={{ marginTop: 24 }}>Tekme</h3>
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
                <div className="player-detail-highs">
                  <span className="muted">≥200 / 220 / 240</span>
                  <strong className="mono">
                    {stats.over200} / {stats.over220} / {stats.over240}
                  </strong>
                </div>
              </div>

              <h3 style={{ marginTop: 28 }}>Povprečje po tekmah</h3>
              <p className="muted">Trend sezone — povprečje kegljev na vsaki tekmi.</p>
              <PlayerMatchAvgChart matches={stats.matches} />

              <h3 style={{ marginTop: 28 }}>Po tekmah</h3>
              <p className="muted">Serija na tekmo (keglji po stezah) in povprečje.</p>
              <div className="table-scroll">
                <table className="player-detail-table">
                  <thead>
                    <tr>
                      <th>Kolo</th>
                      <th>Nasprotnik</th>
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
                        <td>{m.opponentTeamName}</td>
                        <td className="mono player-detail-lanes">
                          {m.games.map((g) => `S${g.lane}:${g.pins}`).join(" · ")}
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
              <p className="muted">
                Skupaj čez sezono — koliko iger in povprečje na vsaki stezi.
              </p>
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
            </>
          )}

          {hasTraining && training && (
            <>
              <h3 style={{ marginTop: 32 }}>Treningi</h3>
              <div className="player-detail-summary">
                <div>
                  <span className="muted">Igre</span>
                  <strong className="mono">{training.games}</strong>
                </div>
                <div>
                  <span className="muted">Keglji</span>
                  <strong className="mono">{training.pins}</strong>
                </div>
                <div>
                  <span className="muted">Povp.</span>
                  <strong className="mono">{fmtAvg(training.avg)}</strong>
                </div>
                <div>
                  <span className="muted">Najboljša</span>
                  <strong className="mono">{training.best}</strong>
                </div>
                <div>
                  <span className="muted">Seje</span>
                  <strong className="mono">{training.sessions.length}</strong>
                </div>
              </div>

              {training.sessions.length > 0 && (
                <>
                  <h3 style={{ marginTop: 28 }}>Povprečje po treningih</h3>
                  <p className="muted">Trend na treningih ekipe.</p>
                  <PlayerAvgChart
                    ariaLabel="Povprečje kegljev po treningih"
                    legendPrefix="Točke = povprečje na trening"
                    points={training.sessions.map((s) => ({
                      id: s.sessionId,
                      label: fmtDate(s.date).replace(/\s/g, ""),
                      avg: s.avg,
                      title: `${fmtDate(s.date)} · ${s.kind === "match" ? "tekma" : "solo"}: ${s.avg.toFixed(1)}`,
                    }))}
                  />

                  <h3 style={{ marginTop: 28 }}>Po treningih</h3>
                  <div className="table-scroll">
                    <table className="player-detail-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Vrsta</th>
                          <th>Igre</th>
                          <th>Skupaj</th>
                          <th>Povp.</th>
                          <th>Naj.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {training.sessions.map((s) => (
                          <tr key={s.sessionId}>
                            <td className="mono">{fmtDate(s.date)}</td>
                            <td>{s.kind === "match" ? "Tekma" : "Solo"}</td>
                            <td className="mono">{s.games}</td>
                            <td className="mono">{s.pins}</td>
                            <td className="mono">{fmtAvg(s.avg)}</td>
                            <td className="mono">{s.best}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {!hasTraining && hasMatch && (
            <p className="muted" style={{ marginTop: 28 }}>
              Za tega igralca še ni vnesenih treningov.
            </p>
          )}
        </>
      )}
    </section>
  );
}
