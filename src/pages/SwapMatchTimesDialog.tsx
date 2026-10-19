import { useMemo, useState } from "react";
import { formatMatchWhen } from "../lib/labels";
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

export function SwapMatchTimesDialog({ onClose }: { onClose: () => void }) {
  const { state, swapMatchStartsAt } = useStore();
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
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");

  const matchA = matches.find((m) => m.id === idA);
  const matchB = matches.find((m) => m.id === idB);
  const canSwap = Boolean(matchA && matchB && idA !== idB);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="swap-times-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="swap-times-title">Zamenjaj termin</h2>
        <p className="muted">
          Izberi dve tekmi — zamenjata si datum in uro. Ekipe in krog ostaneta enaka.
        </p>

        <label className="dialog-field">
          Prva tekma
          <select value={idA} onChange={(e) => setIdA(e.target.value)}>
            <option value="">— izberi —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === idB}>
                {matchLabel(m, state.teams)}
              </option>
            ))}
          </select>
        </label>

        <label className="dialog-field">
          Druga tekma
          <select value={idB} onChange={(e) => setIdB(e.target.value)}>
            <option value="">— izberi —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === idA}>
                {matchLabel(m, state.teams)}
              </option>
            ))}
          </select>
        </label>

        {canSwap && matchA && matchB && (
          <div className="swap-times-preview muted">
            <p>
              <strong>{formatMatchWhen(matchA.startsAt) || "—"}</strong>
              {" ↔ "}
              <strong>{formatMatchWhen(matchB.startsAt) || "—"}</strong>
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
            disabled={!canSwap}
            onClick={() => {
              if (!canSwap) return;
              swapMatchStartsAt(idA, idB);
              onClose();
            }}
          >
            Zamenjaj
          </button>
        </div>
      </div>
    </div>
  );
}
