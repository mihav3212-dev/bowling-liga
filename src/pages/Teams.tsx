import { useState } from "react";
import { exportRegistrationPdf } from "../lib/exportPdf";
import { inferSeasonKey, leagueSeasonTitle } from "../lib/fixtures";
import { TEAM_COUNT } from "../lib/scoring";
import { useStore } from "../lib/store";

export function Teams({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, addTeam, generateSchedule } = useStore();
  const [name, setName] = useState("");
  const [exporting, setExporting] = useState(false);

  return (
    <section className="panel">
      <h2 className="round-title">
        Ekipe ({state.teams.length}/{inferSeasonKey(state) === "2025-26" ? 12 : TEAM_COUNT})
      </h2>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addTeam(name);
          setName("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ime ekipe" />
        <button className="primary" type="submit">
          Dodaj
        </button>
        <button className="ghost" type="button" onClick={generateSchedule}>
          Sestavi razpored
        </button>
        <button
          className="ghost"
          type="button"
          disabled={exporting || state.teams.length === 0}
          onClick={async () => {
            setExporting(true);
            try {
              await exportRegistrationPdf(state);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Pripravljam…" : "Izvozi prijavne liste"}
        </button>
      </form>
      <p className="muted">
        Sezona {leagueSeasonTitle(state)}: {state.teams.length} ekip, {state.matches.length} tekem.
        Vodjo, telefon, e-pošto in igralce vpišeš v ekipi.
      </p>
      <div className="list" style={{ marginTop: 16 }}>
        {state.teams.map((team) => {
          const n = state.players.filter((p) => p.teamId === team.id).length;
          return (
            <button className="row" key={team.id} type="button" onClick={() => onOpen(team.id)}>
              <span>{team.name}</span>
              <span className="pill">{n} igralcev</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
