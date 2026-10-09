import { useRef } from "react";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

export function AdminMenu({
  canEdit,
  onNewSeason,
}: {
  canEdit: boolean;
  onNewSeason: () => void;
}) {
  const { state, archived, importState, loadSeason2025 } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <details className="admin-menu">
      <summary>Admin</summary>
      <div className="admin-menu-panel">
        {archived && <p className="muted">Arhiv — samo branje.</p>}
        {canEdit && (
          <>
            <button className="primary" type="button" onClick={onNewSeason}>
              Nova sezona
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Naloži sezono 2025/26 (12 ekip, 22 krogov) v trenutno sezono? Rezultati te sezone se zbrišejo.",
                  )
                ) {
                  loadSeason2025();
                }
              }}
            >
              Naloži 2025/26
            </button>
          </>
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
