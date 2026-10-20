import { useMemo, useState } from "react";
import {
  formatTrainingDate,
  getTeamSessions,
  playerCountLabel,
  trainingMatchTitle,
} from "../lib/training";
import { useStore } from "../lib/store";
import { Training } from "./Training";
import { TrainingMatch } from "./TrainingMatch";

/** Admin zavihek: posamezni trening (mešane ekipe → zrcali v ekipe) + trening tekma (2 ekipi). */
export function AdminTraining({
  sessionId,
  onOpen,
  onBack,
}: {
  sessionId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const {
    state,
    remote,
    newTrainingSession,
    newTrainingMatch,
    deleteTrainingSession,
    saveTrainingNow,
  } = useStore();
  const sessions = useMemo(
    () =>
      [...getTeamSessions(state, null)].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
      ),
    [state],
  );
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const [createOpen, setCreateOpen] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState(state.teams[0]?.id ?? "");
  const [awayTeamId, setAwayTeamId] = useState(state.teams[1]?.id ?? "");
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

  if (session) {
    return (
      <Training
        sessionId={session.id}
        ownerTeamId={null}
        canPickTeam={false}
        onOpen={onOpen}
        onBack={onBack}
      />
    );
  }

  const canCreate =
    Boolean(homeTeamId && awayTeamId) && homeTeamId !== awayTeamId && state.teams.length >= 2;

  return (
    <section className="panel">
      <h2 className="round-title">Trening</h2>
      <p className="muted">
        Samo za admina. Posamezni trening — igralci iz različnih ekip; rezultati se prenesejo v treninge vsake
        ekipe. Trening tekma — dve ekipi dogovorita sestavo in keglje (vidno tudi pri obeh ekipah).
      </p>
      <p className="muted">
        Ekipe same še vedno beležijo svoje treninge pod Ekipe → podrobnosti.
      </p>
      <p className="muted">
        {remote
          ? "Treningi se shranjujejo v trenutno sezono (baza)."
          : "Treningi se shranjujejo v ta brskalnik, dokler ni vklopljena baza."}
      </p>

      <div className="row-actions">
        <button className="primary" type="button" onClick={() => onOpen(newTrainingSession())}>
          Posamezni trening
        </button>
        <button
          className="ghost"
          type="button"
          disabled={state.teams.length < 2}
          onClick={() => {
            setHomeTeamId(state.teams[0]?.id ?? "");
            setAwayTeamId(state.teams[1]?.id ?? "");
            setCreateOpen(true);
          }}
        >
          Nova trening tekma
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Še ni treningov.
        </p>
      ) : (
        <div className="list training-list" style={{ marginTop: 16 }}>
          {sessions.map((item) => (
            <div key={item.id} className="form-row training-row">
              <button className="ghost" type="button" onClick={() => onOpen(item.id)}>
                {formatTrainingDate(item.date)}
                {item.kind === "match"
                  ? ` · tekma · ${trainingMatchTitle(item, state.teams)}`
                  : item.scores.length
                    ? ` · posamezni · ${playerCountLabel(item.scores.length)}`
                    : " · posamezni"}
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => {
                  if (window.confirm("Izbrišem ta trening?")) {
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
              Izberi dve ekipi, ki se dogovorita za trening. Sestavo in keglje vpišeš na naslednjem koraku; rezultat
              se prikaže tudi pri obeh ekipah.
            </p>
            <label className="dialog-field">
              Ekipa A
              <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialog-field">
              Ekipa B
              <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
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
                  const id = newTrainingMatch(
                    { teamId: homeTeamId },
                    { teamId: awayTeamId },
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
