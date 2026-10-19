import { useEffect, useState } from "react";
import { formatMatchWhen } from "../lib/labels";
import { isoStart, SLOT_TIMES, splitStartsAt } from "../lib/schedule";
import { useStore } from "../lib/store";
import type { Match } from "../lib/types";

const TIME_OPTIONS = [...SLOT_TIMES, "17:00", "17:30", "19:00", "20:00", "20:30", "22:00"] as const;

export function RescheduleMatchDialog({
  match,
  onClose,
}: {
  match: Match;
  onClose: () => void;
}) {
  const { state, setMatchStartsAt } = useStore();
  const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
  const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
  const initial = splitStartsAt(match.startsAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [customTime, setCustomTime] = useState(
    !(TIME_OPTIONS as readonly string[]).includes(initial.time),
  );

  useEffect(() => {
    const next = splitStartsAt(match.startsAt);
    setDate(next.date);
    setTime(next.time);
    setCustomTime(!(TIME_OPTIONS as readonly string[]).includes(next.time));
  }, [match.id, match.startsAt]);

  const preview = date && time ? formatMatchWhen(isoStart(date, time)) : "";
  const canSave = Boolean(date && /^\d{2}:\d{2}$/.test(time));

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-labelledby="reschedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reschedule-title">Spremeni termin</h2>
        <p className="muted">
          {match.round}. kolo · {home} — {away}
          {match.startsAt ? (
            <>
              <br />
              Trenutno: {formatMatchWhen(match.startsAt)}
            </>
          ) : null}
        </p>
        <p className="muted">
          Ko se ekipi dogovorita za drug termin, tu popraviš datum in uro na razporedu.
        </p>

        <label className="dialog-field">
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="dialog-field">
          Ura
          {customTime ? (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={300}
            />
          ) : (
            <select
              value={(TIME_OPTIONS as readonly string[]).includes(time) ? time : SLOT_TIMES[0]}
              onChange={(e) => {
                if (e.target.value === "__custom") {
                  setCustomTime(true);
                  return;
                }
                setTime(e.target.value);
              }}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__custom">Druga ura…</option>
            </select>
          )}
        </label>

        {preview && (
          <p className="muted">
            Novo: <strong className="mono">{preview}</strong>
          </p>
        )}

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
              setMatchStartsAt(match.id, isoStart(date, time));
              onClose();
            }}
          >
            Shrani termin
          </button>
        </div>
      </div>
    </div>
  );
}
