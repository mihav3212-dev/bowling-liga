import { useMemo, useState } from "react";
import { formatMatchWhen } from "../lib/labels";
import { matchTotals } from "../lib/scoring";
import { useStore } from "../lib/store";
import type { Match } from "../lib/types";

function matchHasPins(match: Match): boolean {
  return match.rounds.some((r) => r.games.some((g) => g.homePins != null || g.awayPins != null));
}

function matchLabel(
  match: { id: string; round: number; homeTeamId: string; awayTeamId: string; startsAt?: string },
  teams: { id: string; name: string }[],
): string {
  const home = teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
  const away = teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
  const when = formatMatchWhen(match.startsAt) || "brez termina";
  return `${match.round}. kolo · ${when} · ${home} — ${away}`;
}

export function DeleteMatchDialog({ onClose }: { onClose: () => void }) {
  const { state, deleteMatch } = useStore();
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
  const [id, setId] = useState("");
  const match = matches.find((m) => m.id === id);
  const hasPins = match ? matchHasPins(match) : false;
  const complete = match ? matchTotals(match, state.players).complete : false;

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="delete-match-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-match-title">Izbriši tekmo</h2>
        <p className="muted">
          Odstrani termin iz razporeda (npr. ekipa ni igrala). Lestvica upošteva samo odigrane
          tekme. Če želiš drug termin zapolniti, potem uporabi Zamenjaj termin.
        </p>

        <label className="dialog-field">
          Tekma
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">— izberi —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {matchLabel(m, state.teams)}
              </option>
            ))}
          </select>
        </label>

        {match && (hasPins || complete) && (
          <p className="muted">
            Ta tekma ima že vpisane keglje
            {complete ? " (končana)" : ""}. Brisanje jih trajno odstrani z lestvice.
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Prekliči
          </button>
          <button
            type="button"
            className="primary"
            disabled={!match}
            onClick={() => {
              if (!match) return;
              const label = matchLabel(match, state.teams);
              const warn = hasPins || complete ? " Ima že rezultate." : "";
              if (!window.confirm(`Res zbrišem tekmo?\n${label}.${warn}`)) return;
              deleteMatch(match.id);
              onClose();
            }}
          >
            Izbriši
          </button>
        </div>
      </div>
    </div>
  );
}
