import { useMemo, useState } from "react";
import { playerTag, parsePins } from "../lib/labels";
import { scoredPins } from "../lib/scoring";
import { useStore } from "../lib/store";
import {
  formatTrainingDate,
  gameColumnCount,
  getTeamSessions,
  padGames,
  playerCountLabel,
  scoreAverage,
  scoreTotal,
  trainingMatchTitle,
} from "../lib/training";
import type { Player } from "../lib/types";
import { TrainingMatch } from "./TrainingMatch";

function PinField({
  raw,
  player,
  onChange,
  readOnly,
}: {
  raw: number | null;
  player?: Player;
  onChange: (pins: number | null) => void;
  readOnly?: boolean;
}) {
  const final = scoredPins(raw, player);
  const showAdj = raw != null && final != null && final !== raw;
  return (
    <span className="pin-entry">
      <input
        className="mono"
        inputMode="numeric"
        value={raw ?? ""}
        readOnly={readOnly}
        onChange={(e) => {
          if (!readOnly) onChange(parsePins(e.target.value));
        }}
        aria-label="Keglji"
      />
      {showAdj ? <span className="pin-adj">({final})</span> : null}
    </span>
  );
}

export function Training({
  sessionId,
  ownerTeamId,
  canPickTeam,
  onOpen,
  onBack,
}: {
  sessionId: string | null;
  ownerTeamId: string | null;
  canPickTeam: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const {
    state,
    newTrainingSession,
    setTrainingDate,
    pickTrainingPlayer,
    setTrainingPins,
    removeTrainingScore,
    deleteTrainingSession,
    saveTrainingNow,
    remote,
  } = useStore();
  const sessions = [...getTeamSessions(state, ownerTeamId ?? undefined)].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  const ownerTeam = state.teams.find((team) => team.id === ownerTeamId);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  const [pickId, setPickId] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  const used = new Set(session?.scores.map((row) => row.playerId) ?? []);
  const pool = useMemo(
    () =>
      [...state.players]
        .filter((p) => !used.has(p.id) && (!ownerTeamId || p.teamId === ownerTeamId))
        .sort((a, b) => a.name.localeCompare(b.name, "sl")),
    [state.players, session?.scores, ownerTeamId],
  );
  const q = playerQuery.trim().toLowerCase();
  const visiblePool = useMemo(() => {
    if (!q) return pool;
    return pool.filter((p) => {
      const team = state.teams.find((t) => t.id === p.teamId)?.name ?? "";
      return `${p.name} ${team}`.toLowerCase().includes(q);
    });
  }, [pool, q, state.teams]);

  const canStart = Boolean(state.training || ownerTeamId || canPickTeam);
  const startNew = () => {
    if (!canStart) return;
    onOpen(newTrainingSession(ownerTeamId ?? undefined));
  };

  if (!session) {
    return (
      <section className="panel">
        <h2 className="round-title">Treningi{ownerTeam ? ` — ${ownerTeam.name}` : ""}</h2>
        <p className="muted">
          {ownerTeamId
            ? "Beleži treninge ekipe. Liga treningi (admin) se tukaj prikažejo kot pregled."
            : "Igralci iz poljubnih ekip. Število iger ni določeno — ob vpisu se odpre naslednje polje."}
        </p>
        <p className="muted">
          {remote
            ? "Treningi te ekipe se shranjujejo v bazo."
            : "Treningi se shranjujejo samo v ta brskalnik, dokler ni vklopljena baza."}
        </p>
        <div className="row-actions">
          <button className="primary" type="button" disabled={!canStart} onClick={startNew}>
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
                  {item.fromLiga ? " · liga" : ""}
                  {item.kind === "match"
                    ? ` · tekma · ${trainingMatchTitle(item, state.teams)}`
                    : item.scores.length
                      ? ` · ${playerCountLabel(item.scores.length)}`
                      : ""}
                </button>
                {!item.fromLiga && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm("Izbrišem ta trening?")) {
                        deleteTrainingSession(item.id, ownerTeamId ?? undefined);
                      }
                    }}
                  >
                    Izbriši
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (session.kind === "match") {
    return <TrainingMatch session={session} ownerTeamId={ownerTeamId} onBack={onBack} />;
  }

  const cols = gameColumnCount(session.scores);
  const ligaReadOnly = Boolean(session.fromLiga);

  return (
    <section className="panel">
      <button className="ghost" type="button" onClick={onBack}>
        ← Vsi treningi
      </button>
      <h2 className="round-title" style={{ marginTop: 12 }}>
        Trening{ligaReadOnly ? " · liga" : ""}
      </h2>
      <label className="training-date">
        Datum
        <input
          type="date"
          value={session.date}
          disabled={ligaReadOnly}
          onChange={(e) => {
            if (ligaReadOnly) return;
            if (e.target.value) setTrainingDate(session.id, e.target.value, ownerTeamId ?? undefined);
          }}
        />
      </label>
      <p className="muted">{formatTrainingDate(session.date)}</p>
      {ligaReadOnly ? (
        <p className="muted">Vnos iz zavihka Trening — samo pregled. Spremembe ureja admin.</p>
      ) : (
        <p className="muted">
          {remote
            ? "Shranjevanje v bazo. Shrani zapiše samo izpolnjene igre."
            : "Shranjevanje samo v ta brskalnik, dokler ni vklopljena baza."}
        </p>
      )}

      {!ligaReadOnly && (
        <>
          <h3>Igralci</h3>
          {pool.length === 0 ? (
            <p className="muted">
              {state.players.filter((p) => !ownerTeamId || p.teamId === ownerTeamId).length === 0
                ? ownerTeamId
                  ? "Ta ekipa še nima igralcev. Najprej jih dodaj zgoraj."
                  : "V bazi še ni igralcev — dodaj jih pri ekipah."
                : "Vsi igralci ekipe so že na tem treningu."}
            </p>
          ) : (
            <form
              className="form-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pickId) return;
                pickTrainingPlayer(session.id, pickId, ownerTeamId ?? undefined);
                setPickId("");
              }}
            >
              <input
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="Išči po imenu"
                aria-label="Išči igralca"
              />
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="Igralec">
                <option value="">Izberi igralca…</option>
                {visiblePool.map((p) => {
                  const team = state.teams.find((t) => t.id === p.teamId)?.name;
                  return (
                    <option key={p.id} value={p.id}>
                      {!ownerTeamId && team ? `${playerTag(p)} · ${team}` : playerTag(p)}
                    </option>
                  );
                })}
              </select>
              <button className="ghost" type="submit" disabled={!pickId}>
                Dodaj
              </button>
            </form>
          )}
        </>
      )}

      <h3 style={{ marginTop: 28 }}>Rezultati</h3>
      {session.scores.length === 0 ? (
        <p className="muted">Najprej dodaj igralce, potem vpiši keglje po igrah.</p>
      ) : (
        <div className="table-scroll">
          <table className="standings training-scores">
            <thead>
              <tr>
                <th>Igralec</th>
                {Array.from({ length: cols }, (_, i) => (
                  <th key={i} className="num">
                    {i + 1}.
                  </th>
                ))}
                <th className="num">Seštevek</th>
                <th className="num">Povp.</th>
                {!ligaReadOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {session.scores.map((row) => {
                const player = state.players.find((p) => p.id === row.playerId);
                const games = padGames(row.games, cols);
                const total = scoreTotal(row, player);
                const avg = scoreAverage(row, player);
                const team = state.teams.find((t) => t.id === player?.teamId);
                return (
                  <tr key={row.playerId}>
                    <td>
                      {player ? playerTag(player) : "—"}
                      {team ? <div className="muted">{team.name}</div> : null}
                    </td>
                    {games.map((raw, i) => (
                      <td key={i} className="num">
                        <PinField
                          raw={raw}
                          player={player}
                          readOnly={ligaReadOnly}
                          onChange={(pins) =>
                            setTrainingPins(session.id, row.playerId, i, pins, ownerTeamId ?? undefined)
                          }
                        />
                      </td>
                    ))}
                    <td className="num mono">{total ?? "—"}</td>
                    <td className="num mono">{avg == null ? "—" : avg.toFixed(1)}</td>
                    {!ligaReadOnly && (
                      <td>
                        <button
                          className="danger"
                          type="button"
                          onClick={() =>
                            removeTrainingScore(session.id, row.playerId, ownerTeamId ?? undefined)
                          }
                        >
                          Odstrani
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!ligaReadOnly && (
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button
            className="primary"
            type="button"
            disabled={saveBusy}
            onClick={async () => {
              setSaveBusy(true);
              setSaveNote("");
              const ok = await saveTrainingNow();
              setSaveBusy(false);
              setSaveNote(
                ok ? (remote ? "Shranjeno v bazo." : "Shranjeno v ta brskalnik.") : "Shranjevanje ni uspelo.",
              );
            }}
          >
            {saveBusy ? "Shranjujem…" : "Shrani"}
          </button>
          {saveNote && <span className="muted">{saveNote}</span>}
        </div>
      )}
    </section>
  );
}
