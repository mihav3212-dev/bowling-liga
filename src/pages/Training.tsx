import { useMemo, useState } from "react";
import { playerTag, parsePins } from "../lib/labels";
import { scoredPins } from "../lib/scoring";
import { useStore } from "../lib/store";
import { formatTrainingDate, gameColumnCount, getTeamSessions, padGames, playerCountLabel, scoreTotal, trainingMatchTitle } from "../lib/training";
import type { Gender, Player } from "../lib/types";
import { TrainingMatch } from "./TrainingMatch";

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
  ownerTeamId,
  canPickTeam,
  onOpen,
  onBack,
  onOwnerTeam,
}: {
  sessionId: string | null;
  ownerTeamId: string | null;
  canPickTeam: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
  onOwnerTeam: (id: string) => void;
}) {
  const {
    state,
    newTrainingSession,
    newTrainingMatch,
    setTrainingDate,
    addTrainingPlayer,
    pickTrainingPlayer,
    setTrainingPins,
    removeTrainingScore,
    deleteTrainingSession,
  } = useStore();
  const sessions = [...getTeamSessions(state, ownerTeamId ?? undefined)].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  const ownerTeam = state.teams.find((team) => team.id === ownerTeamId);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [bzs, setBzs] = useState(false);
  const [pickId, setPickId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [awayName, setAwayName] = useState("");

  const used = new Set(session?.scores.map((row) => row.playerId) ?? []);
  const pool = useMemo(
    () =>
      [...state.players]
        .filter((p) => !used.has(p.id) && (!ownerTeamId || p.teamId === ownerTeamId))
        .sort((a, b) => a.name.localeCompare(b.name, "sl")),
    [state.players, session?.scores, ownerTeamId],
  );

  const canStart = Boolean(state.training || ownerTeamId);
  const startNew = () => {
    if (!canStart) return;
    onOpen(newTrainingSession(ownerTeamId ?? undefined));
  };
  const startMatch = () => {
    if (!canStart) return;
    const picked = awayId || undefined;
    const typed = awayName.trim();
    if (!picked && !typed) return;
    onOpen(newTrainingMatch(ownerTeamId ?? undefined, { teamId: picked, name: typed }));
    setAwayId("");
    setAwayName("");
  };

  if (!session) {
    return (
      <section className="panel">
        <h2 className="round-title">Trening{ownerTeam ? ` — ${ownerTeam.name}` : ""}</h2>
        {canPickTeam && (
          <label className="training-date">
            Ekipa
            <select value={ownerTeamId ?? ""} onChange={(e) => onOwnerTeam(e.target.value)}>
              <option value="">Izberi ekipo…</option>
              {state.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="muted">
          Posamezni trening: igralci in rezultati (4 igre, po potrebi več polj). Trening kot tekma: izbereš
          ali vpišeš nasprotnika, potem sestavo in zapisnik kot na ligi.
        </p>
        <div className="row-actions">
          <button className="primary" type="button" disabled={!canStart} onClick={startNew}>
            Novi trening
          </button>
        </div>
        <h3>Trening kot tekma</h3>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            startMatch();
          }}
        >
          <select
            value={awayId}
            onChange={(e) => {
              setAwayId(e.target.value);
              if (e.target.value) setAwayName("");
            }}
            aria-label="Nasprotna ekipa"
          >
            <option value="">Izberi nasprotnika…</option>
            {state.teams
              .filter((team) => team.id !== ownerTeamId)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
          <input
            value={awayName}
            onChange={(e) => {
              setAwayName(e.target.value);
              if (e.target.value) setAwayId("");
            }}
            placeholder="ali vpiši ime ekipe"
          />
          <button className="ghost" type="submit" disabled={!canStart || (!awayId && !awayName.trim())}>
            Odpri tekmo
          </button>
        </form>
        {sessions.length === 0 ? (
          <p className="muted">Še ni shranjenih treningov.</p>
        ) : (
          <div className="list training-list">
            {sessions.map((item) => (
              <div key={item.id} className="form-row training-row">
                <button className="ghost" type="button" onClick={() => onOpen(item.id)}>
                  {formatTrainingDate(item.date)}
                  {item.kind === "match"
                    ? ` · tekma · ${trainingMatchTitle(item, state.teams)}`
                    : item.scores.length
                      ? ` · ${playerCountLabel(item.scores.length)}`
                      : ""}
                </button>
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

  return (
    <section className="panel">
      <button className="ghost" type="button" onClick={onBack}>
        ← Vsi treningi
      </button>
      <h2 className="round-title" style={{ marginTop: 12 }}>
        Trening{ownerTeam ? ` — ${ownerTeam.name}` : ""}
      </h2>
      <label className="training-date">
        Datum
        <input
          type="date"
          value={session.date}
          onChange={(e) => {
            if (e.target.value) setTrainingDate(session.id, e.target.value, ownerTeamId ?? undefined);
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
            pickTrainingPlayer(session.id, pickId, ownerTeamId ?? undefined);
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
          addTrainingPlayer(session.id, name, gender, bzs, ownerTeamId ?? undefined);
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
                {Array.from({ length: cols }, (_, i) => (
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
                const games = padGames(row.games, cols);
                const total = scoreTotal(row, player);
                return (
                  <tr key={row.playerId}>
                    <td>{player ? playerTag(player) : "—"}</td>
                    {games.map((raw, i) => (
                      <td key={i} className="num">
                        <PinField
                          raw={raw}
                          player={player}
                          onChange={(pins) =>
                            setTrainingPins(session.id, row.playerId, i, pins, ownerTeamId ?? undefined)
                          }
                        />
                      </td>
                    ))}
                    <td className="num mono">{total ?? "—"}</td>
                    <td>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => removeTrainingScore(session.id, row.playerId, ownerTeamId ?? undefined)}
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
