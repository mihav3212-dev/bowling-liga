import { useRef } from "react";
import { seasonIsComplete } from "../lib/scoring";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

export function AdminMenu({
  canEdit,
  onNewSeason,
}: {
  canEdit: boolean;
  onNewSeason: () => void;
}) {
  const { state, archived, importState, loadSeason2025, closeSeason } = useStore();
  const complete = seasonIsComplete(state);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <details className="admin-menu">
      <summary>Admin</summary>
      <div className="admin-menu-panel">
        {archived && <p className="muted">Arhiv — samo branje.</p>}
        <button className="primary" type="button" onClick={onNewSeason}>
          Nova sezona
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            if (window.confirm("Odpre sezono 2025/26 (22 krogov) poleg obstoječih. Trenutna ostane.")) {
              void loadSeason2025();
            }
          }}
        >
          Naloži 2025/26
        </button>
        {canEdit && (
          <button
            className="ghost"
            type="button"
            disabled={!complete}
            title={complete ? "Arhivira sezono (samo branje)." : "Najprej vnesi vse rezultate."}
            onClick={() => {
              if (window.confirm("Zaključi sezono? Ostane v arhivu, samo za ogled.")) {
                void closeSeason();
              }
            }}
          >
            Zaključi sezono
          </button>
        )}
        <button
          className="ghost"
          type="button"
          title="Shrani celotno sezono (ekipe, igralce, razpored in rezultate) v datoteko."
          onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "bowling-liga.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Izvozi JSON
        </button>
        {canEdit && (
          <button
            className="ghost"
            type="button"
            title="Naloži prej izvožen JSON. Zamenja celotno trenutno sezono."
            onClick={() => fileRef.current?.click()}
          >
            Uvozi JSON
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const next = JSON.parse(await file.text()) as LeagueState;
              if (!Array.isArray(next.teams) || !Array.isArray(next.players)) {
                throw new Error("invalid");
              }
              importState(next);
            } catch {
              window.alert("Datoteka ni veljaven izvoz lige.");
            }
          }}
        />
        <p className="muted admin-menu-hint">
          JSON je varnostna kopija cele sezone, ne obrazec za vnos posamezne tekme.
        </p>
      </div>
    </details>
  );
}
