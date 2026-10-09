import { useState } from "react";
import { exportRegistrationPdf } from "../lib/exportPdf";
import { leagueSeasonTitle } from "../lib/fixtures";
import { useStore } from "../lib/store";

export function Teams({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, addTeam, generateSchedule, resetDemo, loadSeason2025 } = useStore();
  const [name, setName] = useState("");
  const [exporting, setExporting] = useState(false);
  const emptySchedule = state.matches.length === 0;
  const canBuild = emptySchedule && state.teams.length >= 2;

  return (
    <section className="panel">
      <h2 className="round-title">Ekipe ({state.teams.length})</h2>
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
        {canBuild && (
          <button
            className="primary"
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Sestavi razpored za ${state.teams.length} ekip? Če imena ustrezajo uradni sezoni, se naloži uradni koledar, sicer krožni razpored.`,
                )
              ) {
                generateSchedule();
              }
            }}
          >
            Sestavi razpored
          </button>
        )}
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
      {emptySchedule ? (
        <p className="muted">
          Nova sezona {leagueSeasonTitle(state)}: dodaj ekipe, nato sestavi razpored. Razpored se
          naredi samo enkrat, ko še ni tekem.
        </p>
      ) : (
        <p className="muted">
          Sezona {leagueSeasonTitle(state)}: {state.teams.length} ekip, {state.matches.length} tekem.
          Vodjo, telefon, e-pošto in igralce vpišeš v ekipi.
        </p>
      )}
      {emptySchedule && (
        <p className="muted" style={{ marginTop: 8 }}>
          Ali naloži pripravljen razpored:{" "}
          <button
            className="ghost"
            type="button"
            onClick={() => {
              if (window.confirm("Naloži ekipe in koledar 2026/27? Trenutni vnos ekip se zbriše.")) {
                resetDemo();
              }
            }}
          >
            2026/27
          </button>{" "}
          <button
            className="ghost"
            type="button"
            onClick={() => {
              if (window.confirm("Odpre sezono 2025/26 (22 krogov) poleg obstoječih?")) {
                loadSeason2025();
              }
            }}
          >
            2025/26
          </button>
        </p>
      )}
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
