import { useMemo, useState } from "react";
import { playerTag, parsePins } from "../lib/labels";
import { scoredPins } from "../lib/scoring";
import { useStore } from "../lib/store";
import { formatTrainingDate, padGames, scoreTotal, TRAINING_GAMES } from "../lib/training";
import type { Gender, Player } from "../lib/types";

function PinField({
  raw,
  player,
  onChange,
}: {
  raw: number | null;
  player?: Player;
  onChange: (pins: number | null) => void;
}) {
  const final = scoredPins(raw, player);
  const showAdj = raw != null && final != null && final !== raw;
  return (
    <span className="pin-entry">
      <input
        className="mono"
        inputMode="numeric"
        value={raw ?? ""}
        onChange={(e) => onChange(parsePins(e.target.value))}
        aria-label="Keglji"
      />
      {showAdj ? <span className="pin-adj">({final})</span> : null}
    </span>
  );
}

export function Training({
  sessionId,
  onOpen,
  onBack,
}: {
  sessionId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const {
    state,
    newTrainingSession,
    setTrainingDate,
    addTrainingPlayer,
    pickTrainingPlayer,
    setTrainingPins,
    removeTrainingScore,
    deleteTrainingSession,
  } = useStore();
  const sessions = [...(state.trainingSessions ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [bzs, setBzs] = useState(false);
  const [pickId, setPickId] = useState("");

  const used = new Set(session?.scores.map((row) => row.playerId) ?? []);
  const pool = useMemo(
    () =>
      [...state.players]
        .filter((p) => !used.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name, "sl")),
    [state.players, session?.scores],
  );

  const startNew = () => {
    onOpen(newTrainingSession());
  };

  if (!session) {
    return (
      <section className="panel">
        <h2 className="round-title">Trening</h2>
        <p className="muted">
          Novi trening dobi današnji datum. Znotraj vpišeš ali izbereš igralce in pod njimi rezultate (3 igre).
        </p>
        <div className="row-actions">
          <button className="primary" type="button" onClick={startNew}>
            Novi trening
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">Še ni shranjenih treningov.</p>
        ) : (
          <div className="list training-list">
            {sessions.map((item) => (
              <div key={item.id} className="form-row training-row">
                <button className="ghost" type="button" onClick={() => onOpen(item.id)}>
                  {formatTrainingDate(item.date)}
                  {item.scores.length ? ` · ${item.scores.length} igralcev` : ""}
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    if (window.confirm("Izbrišem ta trening?")) deleteTrainingSession(item.id);
                  }}
                >
                  Izbriši
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel">
      <button className="ghost" type="button" onClick={onBack}>
        ← Vsi treningi
      </button>
      <h2 className="round-title" style={{ marginTop: 12 }}>
        Trening
      </h2>
      <label className="training-date">
        Datum
        <input
          type="date"
          value={session.date}
          onChange={(e) => {
            if (e.target.value) setTrainingDate(session.id, e.target.value);
          }}
        />
      </label>
      <p className="muted">{formatTrainingDate(session.date)}</p>

      <h3>Igralci</h3>
      {pool.length > 0 && (
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pickId) return;
            pickTrainingPlayer(session.id, pickId);
            setPickId("");
          }}
        >
          <select value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="Obstoječi igralec">
            <option value="">Izberi igralca…</option>
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {playerTag(p)}
              </option>
            ))}
          </select>
          <button className="ghost" type="submit" disabled={!pickId}>
            Dodaj izbranega
          </button>
        </form>
      )}
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addTrainingPlayer(session.id, name, gender, bzs);
          setName("");
          setGender("M");
          setBzs(false);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ime igralca" />
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="M">Moški</option>
          <option value="F">Ženska (+8)</option>
        </select>
        <label className="muted">
          <input type="checkbox" checked={bzs} onChange={(e) => setBzs(e.target.checked)} /> član BZS (−8)
        </label>
        <button className="primary" type="submit">
          Vnesi igralca
        </button>
      </form>

      <h3 style={{ marginTop: 28 }}>Rezultati</h3>
      {session.scores.length === 0 ? (
        <p className="muted">Najprej dodaj igralce, potem vpiši keglje po igrah.</p>
      ) : (
        <div className="table-scroll">
          <table className="standings training-scores">
            <thead>
              <tr>
                <th>Igralec</th>
                {Array.from({ length: TRAINING_GAMES }, (_, i) => (
                  <th key={i} className="num">
                    {i + 1}. igra
                  </th>
                ))}
                <th className="num">Seštevek</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {session.scores.map((row) => {
                const player = state.players.find((p) => p.id === row.playerId);
                const games = padGames(row.games);
                const total = scoreTotal(row, player);
                return (
                  <tr key={row.playerId}>
                    <td>{player ? playerTag(player) : "—"}</td>
                    {games.map((raw, i) => (
                      <td key={i} className="num">
                        <PinField
                          raw={raw}
                          player={player}
                          onChange={(pins) => setTrainingPins(session.id, row.playerId, i, pins)}
                        />
                      </td>
                    ))}
                    <td className="num mono">{total ?? "—"}</td>
                    <td>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => removeTrainingScore(session.id, row.playerId)}
                      >
                        Odstrani
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
