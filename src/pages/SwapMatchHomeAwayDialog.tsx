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

export function SwapMatchHomeAwayDialog({ onClose }: { onClose: () => void }) {
  const { state, swapMatchHomeAway } = useStore();
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

  const match = matches.find((m) => m.id === matchId);
  const homeName = match ? (state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?") : "";
  const awayName = match ? (state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?") : "";
  const canSwap = Boolean(match);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="swap-home-away-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="swap-home-away-title">Zamenjaj domačin / gost</h2>
        <p className="muted">
          Izberi tekmo — ekipe si zamenjata vlogo (domačin ↔ gost). Termin in kolo ostaneta enaka;
          sestava in vpisani keglji se zrcalijo.
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

        {canSwap && match && (
          <div className="swap-times-preview muted">
            <p>
              <strong>{homeName}</strong> (doma) — <strong>{awayName}</strong> (gost)
            </p>
            <p>
              → <strong>{awayName}</strong> (doma) — <strong>{homeName}</strong> (gost)
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
              if (!matchId) return;
              swapMatchHomeAway(matchId);
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
