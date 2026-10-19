import { useMemo, useState } from "react";
import {
  formatTrainingDate,
  getTeamSessions,
  trainingMatchTitle,
} from "../lib/training";
import { useStore } from "../lib/store";
import { TrainingMatch } from "./TrainingMatch";

/** Admin zavihek: trening kot tekma (skupini → sestava 2–4 → keglji). */
export function AdminTraining({
  sessionId,
  onOpen,
  onBack,
}: {
  sessionId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const { state, remote, newTrainingMatch, deleteTrainingSession, saveTrainingNow } = useStore();
  const sessions = useMemo(
    () =>
      [...getTeamSessions(state, null)]
        .filter((s) => s.kind === "match")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [state],
  );
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const [createOpen, setCreateOpen] = useState(false);
  const [homeName, setHomeName] = useState("Skupina A");
  const [awayName, setAwayName] = useState("Skupina B");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  if (session?.kind === "match") {
    return (
      <>
        <TrainingMatch session={session} ownerTeamId={null} onBack={onBack} />
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              window.open(
                `/?display=training&id=${encodeURIComponent(session.id)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            TV pogled
          </button>
          <button
            className="primary"
            type="button"
            disabled={saveBusy}
            onClick={async () => {
              setSaveBusy(true);
              setSaveNote("");
              const ok = await saveTrainingNow();
              setSaveBusy(false);
              setSaveNote(ok ? (remote ? "Shranjeno." : "Shranjeno v ta brskalnik.") : "Shranjevanje ni uspelo.");
            }}
          >
            {saveBusy ? "Shranjujem…" : "Shrani trening"}
          </button>
          {saveNote && <span className="muted">{saveNote}</span>}
        </div>
      </>
    );
  }

  const canCreate =
    Boolean(homeName.trim() && awayName.trim()) &&
    !(homeTeamId && awayTeamId && homeTeamId === awayTeamId);

  return (
    <section className="panel">
      <h2 className="round-title">Trening</h2>
      <p className="muted">
        Samo za admina. Ustvari trening tekmo (2–4 igralci na stran, tudi iz različnih ekip), nato sestavo in
        keglje.
      </p>
      <p className="muted">
        {remote
          ? "Treningi se shranjujejo v trenutno sezono (baza)."
          : "Treningi se shranjujejo v ta brskalnik, dokler ni vklopljena baza."}
      </p>

      <div className="row-actions">
        <button
          className="primary"
          type="button"
          onClick={() => {
            setHomeName("Skupina A");
            setAwayName("Skupina B");
            setHomeTeamId("");
            setAwayTeamId("");
            setCreateOpen(true);
          }}
        >
          Nova trening tekma
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Še ni trening tekem.
        </p>
      ) : (
        <div className="list training-list" style={{ marginTop: 16 }}>
          {sessions.map((item) => (
            <div key={item.id} className="form-row training-row">
              <button className="ghost" type="button" onClick={() => onOpen(item.id)}>
                {formatTrainingDate(item.date)}
                {" · "}
                {trainingMatchTitle(item, state.teams)}
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => {
                  if (window.confirm("Izbrišem to trening tekmo?")) {
                    deleteTrainingSession(item.id);
                  }
                }}
              >
                Izbriši
              </button>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="dialog-overlay" role="presentation" onClick={() => setCreateOpen(false)}>
          <div
            className="dialog-panel"
            role="dialog"
            aria-labelledby="admin-training-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-training-title">Nova trening tekma</h2>
            <p className="muted">
              Poimenuj skupini (ali izberi ekipo za ime). Igralce iz poljubnih ekip izbereš na naslednjem koraku.
            </p>
            <label className="dialog-field">
              Skupina A — ime
              <input
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                placeholder="Skupina A"
              />
            </label>
            {state.teams.length > 0 && (
              <label className="dialog-field">
                ali ime iz ekipe
                <select
                  value={homeTeamId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setHomeTeamId(id);
                    if (id) {
                      const t = state.teams.find((x) => x.id === id);
                      if (t) setHomeName(t.name);
                    }
                  }}
                >
                  <option value="">—</option>
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="dialog-field">
              Skupina B — ime
              <input
                value={awayName}
                onChange={(e) => setAwayName(e.target.value)}
                placeholder="Skupina B"
              />
            </label>
            {state.teams.length > 0 && (
              <label className="dialog-field">
                ali ime iz ekipe
                <select
                  value={awayTeamId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAwayTeamId(id);
                    if (id) {
                      const t = state.teams.find((x) => x.id === id);
                      if (t) setAwayName(t.name);
                    }
                  }}
                >
                  <option value="">—</option>
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={() => setCreateOpen(false)}>
                Prekliči
              </button>
              <button
                type="button"
                className="primary"
                disabled={!canCreate}
                onClick={() => {
                  if (!canCreate) return;
                  const id = newTrainingMatch(
                    homeTeamId ? { teamId: homeTeamId } : { name: homeName.trim() },
                    awayTeamId ? { teamId: awayTeamId } : { name: awayName.trim() },
                    "global",
                  );
                  setCreateOpen(false);
                  onOpen(id);
                }}
              >
                Začni
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
