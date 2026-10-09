import { useMemo, useState } from "react";
import { playerTag, parsePins, formatMatchWhen } from "../lib/labels";
import { nominatedIds, pairingTemplate, slotLabel } from "../lib/pairings";
import { matchTotals, scoreGame } from "../lib/scoring";
import { useStore } from "../lib/store";
import type { Player } from "../lib/types";

function playerName(roster: Player[], id: string): string {
  const player = roster.find((p) => p.id === id);
  return player ? playerTag(player) : "—";
}

function LineupReadout({
  label,
  roster,
  starters,
  bench,
}: {
  label: string;
  roster: Player[];
  starters: string[];
  bench: string[];
}) {
  const named = starters.filter(Boolean);
  const reserves = bench.filter(Boolean);
  return (
    <div>
      <h3>{label}</h3>
      {named.length === 0 ? (
        <p className="muted">Sestava ni vnesena.</p>
      ) : (
        <ol className="lineup-list">
          {named.map((id) => (
            <li key={id}>{playerName(roster, id)}</li>
          ))}
        </ol>
      )}
      {reserves.length > 0 && (
        <p className="muted">Menjave: {reserves.map((id) => playerName(roster, id)).join(", ")}</p>
      )}
    </div>
  );
}

function LineupEditor({
  label,
  side,
  roster,
  starters,
  bench,
  onChange,
}: {
  label: string;
  side: "home" | "away";
  roster: Player[];
  starters: string[];
  bench: string[];
  onChange: (starters: string[], bench: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const used = new Set([...starters, ...bench].filter(Boolean));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...roster].sort((a, b) => a.name.localeCompare(b.name, "sl"));
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [roster, query]);
  const options = (current: string) => {
    const pool = filtered.filter((p) => p.id === current || !used.has(p.id));
    if (current && !pool.some((p) => p.id === current)) {
      const extra = roster.find((p) => p.id === current);
      if (extra) return [extra, ...pool];
    }
    return pool;
  };

  return (
    <div>
      <h3>{label}</h3>
      <p className="muted">Izberi 4 + do 2 menjavi iz {roster.length} članov.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Išči igralca"
      />
      {[0, 1, 2, 3].map((i) => (
        <select
          key={`s${i}`}
          value={starters[i] ?? ""}
          onChange={(e) => {
            const next = [...starters];
            next[i] = e.target.value;
            onChange(next, bench);
          }}
        >
          <option value="">{slotLabel(side, i)}</option>
          {options(starters[i] ?? "").map((p) => (
            <option key={p.id} value={p.id}>
              {playerTag(p)}
            </option>
          ))}
        </select>
      ))}
      {[0, 1].map((i) => (
        <select
          key={`b${i}`}
          value={bench[i] ?? ""}
          onChange={(e) => {
            const next = [...bench];
            next[i] = e.target.value;
            onChange(starters, next.filter(Boolean));
          }}
        >
          <option value="">{slotLabel(side, i + 4)}</option>
          {options(bench[i] ?? "").map((p) => (
            <option key={p.id} value={p.id}>
              {playerTag(p)}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

export function MatchEntry({
  matchId,
  onBack,
  readOnly = false,
}: {
  matchId: string;
  onBack: () => void;
  readOnly?: boolean;
}) {
  const { state, setLineup, setPins, setRoundPlayer } = useStore();
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return <p>Tekma ne obstaja.</p>;

  const home = state.teams.find((t) => t.id === match.homeTeamId);
  const away = state.teams.find((t) => t.id === match.awayTeamId);
  const homeRoster = state.players.filter((p) => p.teamId === match.homeTeamId);
  const awayRoster = state.players.filter((p) => p.teamId === match.awayTeamId);
  const totals = matchTotals(match, state.players);
  const homeNom = nominatedIds(match.homeStarters, match.homeBench);
  const awayNom = nominatedIds(match.awayStarters, match.awayBench);

  return (
    <section>
      <button className="ghost" onClick={onBack}>
        ← Nazaj
      </button>
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="match-heading">
          <div>
            <div className="muted">
              {match.round}. kolo
              {match.startsAt ? ` · ${formatMatchWhen(match.startsAt)}` : ""}
            </div>
            <h2 className="match-title">
              {home?.name} — {away?.name}
            </h2>
          </div>
          <div>
            <div className="muted">Rezultat (TOČKE)</div>
            <div className="big-score">
              {totals.complete ? `${totals.homeMatch}:${totals.awayMatch}` : "—"}
            </div>
            <div className="muted">
              Velike: {totals.homeBig}:{totals.awayBig}
              {totals.complete ? " (krogi + 2 za več kegljev)" : ""}
              {" · "}
              Male: {totals.homeSmall}:{totals.awaySmall}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ margin: "16px 0" }}>
        <div className="panel">
          {readOnly ? (
            <LineupReadout
              label={home?.name ?? "Domači"}
              roster={homeRoster}
              starters={match.homeStarters}
              bench={match.homeBench}
            />
          ) : (
            <LineupEditor
              label={`${home?.name ?? "Domači"} (A)`}
              side="home"
              roster={homeRoster}
              starters={match.homeStarters}
              bench={match.homeBench}
              onChange={(starters, bench) => setLineup(match.id, "home", starters, bench)}
            />
          )}
        </div>
        <div className="panel">
          {readOnly ? (
            <LineupReadout
              label={away?.name ?? "Gostje"}
              roster={awayRoster}
              starters={match.awayStarters}
              bench={match.awayBench}
            />
          ) : (
            <LineupEditor
              label={`${away?.name ?? "Gostje"} (B)`}
              side="away"
              roster={awayRoster}
              starters={match.awayStarters}
              bench={match.awayBench}
              onChange={(starters, bench) => setLineup(match.id, "away", starters, bench)}
            />
          )}
        </div>
      </div>

      {match.rounds.map((round, ri) => {
        const pair = pairingTemplate()[ri] ?? [];
        const roundTot = totals.rounds[ri];
        return (
        <div className="scorecard" key={ri} style={{ marginBottom: 16 }}>
          <h3>{ri + 1}. krog</h3>
          <table>
            <thead>
              <tr>
                <th>S</th>
                <th>Domači</th>
                <th>Rez.</th>
                <th>T</th>
                <th>T</th>
                <th>Rez.</th>
                <th>Gostje</th>
              </tr>
            </thead>
            <tbody>
              {round.games.map((game, gi) => {
                const duel = scoreGame(game, state.players);
                const homePlayers = homeRoster.filter((p) => homeNom.includes(p.id));
                const awayPlayers = awayRoster.filter((p) => awayNom.includes(p.id));
                const slots = pair[gi];
                return (
                  <tr key={gi}>
                    <td className="mono" data-label="Steza">{game.lane}</td>
                    <td data-label="Domači">
                      <span className="slot-tag">{slots ? slotLabel("home", slots.homeSlot) : ""}</span>{" "}
                      {readOnly ? (
                        playerName(homeRoster, game.homePlayerId)
                      ) : (
                        <select
                          value={game.homePlayerId}
                          onChange={(e) => setRoundPlayer(match.id, ri, gi, "home", e.target.value)}
                        >
                          <option value="">—</option>
                          {homePlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {playerTag(p)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="mono" data-label="Keglji (domači)">
                      {readOnly ? (
                        game.homePins ?? "—"
                      ) : (
                        <input
                          className="mono"
                          inputMode="numeric"
                          value={game.homePins ?? ""}
                          onChange={(e) =>
                            setPins(match.id, ri, gi, "home", parsePins(e.target.value))
                          }
                        />
                      )}
                    </td>
                    <td className="mono t-cell" data-label="T domači">
                      {duel ? duel.homeTotal : "—"}
                    </td>
                    <td className="mono t-cell" data-label="T gostje">
                      {duel ? duel.awayTotal : "—"}
                    </td>
                    <td className="mono" data-label="Keglji (gostje)">
                      {readOnly ? (
                        game.awayPins ?? "—"
                      ) : (
                        <input
                          className="mono"
                          inputMode="numeric"
                          value={game.awayPins ?? ""}
                          onChange={(e) =>
                            setPins(match.id, ri, gi, "away", parsePins(e.target.value))
                          }
                        />
                      )}
                    </td>
                    <td data-label="Gostje">
                      <span className="slot-tag">{slots ? slotLabel("away", slots.awaySlot) : ""}</span>{" "}
                      {readOnly ? (
                        playerName(awayRoster, game.awayPlayerId)
                      ) : (
                        <select
                          value={game.awayPlayerId}
                          onChange={(e) => setRoundPlayer(match.id, ri, gi, "away", e.target.value)}
                        >
                          <option value="">—</option>
                          {awayPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {playerTag(p)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {roundTot && (
            <p className="muted" style={{ marginTop: 10 }}>
              Seštevek T: {roundTot.homeSmall}:{roundTot.awaySmall}
              {roundTot.complete
                ? ` · velike tega kroga ${roundTot.homeBig}:${roundTot.awayBig} · keglji ${roundTot.homePins}:${roundTot.awayPins}`
                : ""}
            </p>
          )}
        </div>
        );
      })}
    </section>
  );
}
