import { useEffect, useRef, useState } from "react";
import { exportRegistrationPdf } from "../lib/exportPdf";
import { leagueSeasonTitle } from "../lib/fixtures";
import { daysNeededForHalf, daysNeededPerRound, firstHalfComplete, halfRoundCount } from "../lib/schedule";
import { useStore } from "../lib/store";
import { DayPicker } from "./DayPicker";

export function Teams({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, addTeam, drawSchedule, drawReturnSchedule, resetDemo, loadSeason2025 } = useStore();
  const [name, setName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [picker, setPicker] = useState<"first" | "return" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emptySchedule = state.matches.length === 0;
  const canBuild = emptySchedule && state.teams.length >= 2;
  const canReturn = firstHalfComplete(state);
  const needed = daysNeededForHalf(state.teams.length);
  const rounds = halfRoundCount(state.teams.length);

  useEffect(() => {
    if (!addOpen) return;
    setName("");
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [addOpen]);

  const submitAdd = () => {
    if (!name.trim()) return;
    addTeam(name);
    setName("");
    setAddOpen(false);
  };

  return (
    <section className="panel">
      <div className="teams-toolbar">
        <h2 className="round-title teams-toolbar-title">Ekipe ({state.teams.length})</h2>
        <div className="teams-toolbar-actions">
          {canBuild && (
            <button className="primary" type="button" onClick={() => setPicker("first")}>
              Sestavi razpored
            </button>
          )}
          {canReturn && (
            <button className="primary" type="button" onClick={() => setPicker("return")}>
              Žreb 2. dela
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
          <button className="primary" type="button" onClick={() => setAddOpen(true)}>
            Dodaj
          </button>
        </div>
      </div>
      {emptySchedule ? (
        <p className="muted">
          Nova sezona {leagueSeasonTitle(state)}: dodaj ekipe, nato sestavi razpored. Na koledarju izbereš
          dneve tekem, sistem naredi žreb (sreda/četrtek ob 18:00, 19:30 in 21:00).
        </p>
      ) : (
        <p className="muted">
          Sezona {leagueSeasonTitle(state)}: {state.teams.length} ekip, {state.matches.length} tekem.
          Vodjo, telefon, e-pošto in igralce vpišeš v ekipi.
          {canReturn
            ? " Ko je 1. del odigran v razporedu, dodaš 2. del: domačin in gost se zamenjata, dan in ura se premešata."
            : ""}
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
      {addOpen && (
        <div className="dialog-overlay" role="presentation" onClick={() => setAddOpen(false)}>
          <div
            className="dialog-panel"
            role="dialog"
            aria-labelledby="add-team-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-team-title">Nova ekipa</h2>
            <p className="muted">Vpiši ime ekipe. Vodjo, kontakt in igralce dodaš v podrobnostih.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAdd();
              }}
            >
              <label className="dialog-field">
                Ime ekipe
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="npr. Bar 10"
                  autoComplete="off"
                />
              </label>
              <div className="dialog-actions">
                <button type="button" className="ghost" onClick={() => setAddOpen(false)}>
                  Prekliči
                </button>
                <button className="primary" type="submit" disabled={!name.trim()}>
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {picker && (
        <DayPicker
          title={picker === "return" ? "Dnevi 2. dela sezone" : "Dnevi tekem"}
          needed={needed}
          rounds={rounds}
          daysPerRound={daysNeededPerRound(state.teams.length)}
          returnHalf={picker === "return"}
          onCancel={() => setPicker(null)}
          onConfirm={(dates) => {
            try {
              if (picker === "return") drawReturnSchedule(dates);
              else drawSchedule(dates);
              setPicker(null);
            } catch (err) {
              window.alert(err instanceof Error ? err.message : "Žreba ni bilo mogoče narediti.");
            }
          }}
        />
      )}
    </section>
  );
}
