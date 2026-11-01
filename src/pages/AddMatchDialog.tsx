import { useMemo, useState } from "react";
import { formatMatchWhen } from "../lib/labels";
import { isoStart, SLOT_TIMES } from "../lib/schedule";
import { useStore } from "../lib/store";

export function AddMatchDialog({ onClose }: { onClose: () => void }) {
  const { state, addMatch } = useStore();
  const teams = useMemo(
    () => [...state.teams].sort((a, b) => a.name.localeCompare(b.name, "sl")),
    [state.teams],
  );
  const defaultRound = useMemo(() => {
    let max = 0;
    for (const m of state.matches) if (m.round > max) max = m.round;
    return max > 0 ? max : 1;
  }, [state.matches]);

  const [round, setRound] = useState(String(defaultRound));
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string>(SLOT_TIMES[0]);
  const [error, setError] = useState("");

  const roundNum = Math.floor(Number(round));
  const previewIso = date && /^\d{2}:\d{2}$/.test(time) ? isoStart(date, time) : "";
  const homeName = teams.find((t) => t.id === homeTeamId)?.name ?? "";
  const awayName = teams.find((t) => t.id === awayTeamId)?.name ?? "";
  const canSave =
    Number.isFinite(roundNum) &&
    roundNum >= 1 &&
    Boolean(homeTeamId) &&
    Boolean(awayTeamId) &&
    homeTeamId !== awayTeamId &&
    Boolean(date) &&
    /^\d{2}:\d{2}$/.test(time);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="add-match-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-match-title">Dodaj tekmo</h2>
        <p className="muted">
          Vstavi eno tekmo v razpored (npr. nadomestna tekma ali manjkajoči termin). Sestava in
          keglji ostanejo prazni.
        </p>

        <label className="dialog-field">
          Kolo
          <input
            type="number"
            min={1}
            step={1}
            value={round}
            onChange={(e) => {
              setError("");
              setRound(e.target.value);
            }}
          />
        </label>

        <label className="dialog-field">
          Domačin
          <select
            value={homeTeamId}
            onChange={(e) => {
              setError("");
              setHomeTeamId(e.target.value);
            }}
          >
            <option value="">— izberi —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="dialog-field">
          Gost
          <select
            value={awayTeamId}
            onChange={(e) => {
              setError("");
              setAwayTeamId(e.target.value);
            }}
          >
            <option value="">— izberi —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="dialog-field">
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="dialog-field">
          Ura
          <input
            type="time"
            value={time}
            step={300}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>

        <div className="reschedule-slots" role="group" aria-label="Hitri termini">
          {SLOT_TIMES.map((slot) => (
            <button
              key={slot}
              type="button"
              className={`ghost${time === slot ? " is-on" : ""}`}
              onClick={() => setTime(slot)}
            >
              {slot}
            </button>
          ))}
        </div>

        {canSave && (
          <div className="swap-times-preview muted">
            <p>
              {roundNum}. kolo · {formatMatchWhen(previewIso) || previewIso} · {homeName} —{" "}
              {awayName}
            </p>
          </div>
        )}

        {error ? <p className="dialog-error">{error}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Prekliči
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              const ok = addMatch({
                round: roundNum,
                homeTeamId,
                awayTeamId,
                startsAt: isoStart(date, time),
              });
              if (!ok) {
                setError("Ta par ekip v tem kolu že obstaja (ali neveljavni podatki).");
                return;
              }
              onClose();
            }}
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}
