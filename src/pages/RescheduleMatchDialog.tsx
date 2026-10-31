import { useEffect, useMemo, useState } from "react";
import { formatMatchWhen } from "../lib/labels";
import { isoStart, SLOT_TIMES, splitStartsAt } from "../lib/schedule";
import { useStore } from "../lib/store";

function matchLabel(
  match: { id: string; round: number; homeTeamId: string; awayTeamId: string; startsAt?: string },
  teams: { id: string; name: string }[],
): string {
  const home = teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
  const away = teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
  const when = formatMatchWhen(match.startsAt) || "brez termina";
  return `${match.round}. kolo · ${when} · ${home} — ${away}`;
}

export function RescheduleMatchDialog({ onClose }: { onClose: () => void }) {
  const { state, setMatchStartsAt } = useStore();
  const matches = useMemo(
    () =>
      [...state.matches].sort(
        (a, b) =>
          a.round - b.round ||
          (a.startsAt ?? "").localeCompare(b.startsAt ?? "") ||
          a.id.localeCompare(b.id),
      ),
    [state.matches],
  );
  const [matchId, setMatchId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string>(SLOT_TIMES[0]);

  const match = matches.find((m) => m.id === matchId);

  useEffect(() => {
    if (!match) return;
    const split = splitStartsAt(match.startsAt);
    setDate(split.date);
    setTime(split.time || SLOT_TIMES[0]);
  }, [match]);

  const previewIso = date && time ? isoStart(date, time) : "";
  const canSave = Boolean(match && date && /^\d{2}:\d{2}$/.test(time));

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="reschedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reschedule-title">Spremeni termin</h2>
        <p className="muted">
          Prestavi eno tekmo na nov datum in uro (npr. prestavitev). Ekipe in kolo ostaneta enaka.
        </p>

        <label className="dialog-field">
          Tekma
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">— izberi —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {matchLabel(m, state.teams)}
              </option>
            ))}
          </select>
        </label>

        <label className="dialog-field">
          Datum
          <input
            type="date"
            value={date}
            disabled={!match}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="dialog-field">
          Ura
          <input
            type="time"
            value={time}
            disabled={!match}
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
              disabled={!match}
              onClick={() => setTime(slot)}
            >
              {slot}
            </button>
          ))}
        </div>

        {canSave && (
          <div className="swap-times-preview muted">
            <p>
              {formatMatchWhen(match?.startsAt) || "—"}
              {" → "}
              <strong>{formatMatchWhen(previewIso) || previewIso}</strong>
            </p>
          </div>
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
              if (!canSave || !match) return;
              setMatchStartsAt(match.id, isoStart(date, time));
              onClose();
            }}
          >
            Shrani
          </button>
        </div>
      </div>
    </div>
  );
}
