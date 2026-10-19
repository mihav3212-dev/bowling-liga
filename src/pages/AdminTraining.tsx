import { useMemo, useState } from "react";
import {
  formatTrainingDate,
  getTeamSessions,
  trainingMatchTitle,
} from "../lib/training";
import { useStore } from "../lib/store";
import { TrainingMatch } from "./TrainingMatch";

/** Admin zavihek: trening kot tekma (izberi ekipe → sestava → keglji). */
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
  const [homeId, setHomeId] = useState(state.teams[0]?.id ?? "");
  const [awayId, setAwayId] = useState(state.teams[1]?.id ?? "");
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
    state.teams.length >= 2 && homeId && awayId && homeId !== awayId;

  return (
    <section className="panel">
      <h2 className="round-title">Trening</h2>
      <p className="muted">
        Samo za admina. Izberi dve ekipi, nato sestavo igralcev in vnos kegljev kot na tekmi.
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
          disabled={state.teams.length < 2}
          onClick={() => {
            setHomeId(state.teams[0]?.id ?? "");
            setAwayId(state.teams[1]?.id ?? "");
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
            <p className="muted">Izberi ekipe. Igralce za sestavo izbereš na naslednjem koraku.</p>
            <label className="dialog-field">
              Domači
              <select value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === awayId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialog-field">
              Gostje
              <select value={awayId} onChange={(e) => setAwayId(e.target.value)}>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === homeId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
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
                  const id = newTrainingMatch(homeId, { teamId: awayId }, "global");
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
