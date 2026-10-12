import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { remainingOfficialRounds, parseScheduleCsv } from "../lib/schedule";
import { seasonIsComplete } from "../lib/scoring";
import { useStore } from "../lib/store";
import { findSeasonByName } from "../lib/storage";
import type { LeagueState } from "../lib/types";

export function AdminMenu({
  canEdit,
  onNewSeason,
  onTrainingSeason,
}: {
  canEdit: boolean;
  onNewSeason: () => void;
  onTrainingSeason: () => void;
}) {
  const {
    state,
    remote,
    archived,
    seasons,
    seasonId,
    importSeason,
    replaceSeason,
    importFixtures,
    appendOfficialSchedule,
    closeSeason,
    reopenSeason,
  } = useStore();
  const complete = seasonIsComplete(state);
  const leftover = remainingOfficialRounds(state);
  const { logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="admin-menu">
      <button
        className="ghost header-admin"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        Admin
      </button>
      {open && (
        <button
          className="admin-menu-backdrop"
          type="button"
          aria-label="Zapri meni"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
      <div className="admin-menu-panel">
        <button className="ghost admin-menu-logout" type="button" onClick={() => void logout()}>
          Odjava
        </button>
        {archived && (
          <>
            <p className="muted">Arhiv — samo branje.</p>
            <button className="primary" type="button" onClick={() => void reopenSeason()}>
              Odpri sezono
            </button>
          </>
        )}
        <button
          className="primary"
          type="button"
          onClick={() => {
            setOpen(false);
            onNewSeason();
          }}
        >
          Nova sezona
        </button>
        <button
          className="ghost"
          type="button"
          title="Testna sezona za vajo vnosa. Vidiš jo samo prijavljeni."
          onClick={() => {
            setOpen(false);
            onTrainingSeason();
          }}
        >
          Trening / test
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
        {canEdit && leftover > 0 && (
          <button
            className="ghost"
            type="button"
            title="Doda preostala uradna kola (npr. 2. del sezone) k obstoječemu razporedu."
            onClick={() => {
              if (
                window.confirm(
                  `Dodam ${leftover} preostalih krogov iz uradnega razporeda? Obstoječe tekme ostanejo.`,
                )
              ) {
                try {
                  appendOfficialSchedule();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Razporeda ni bilo mogoče dodati.");
                }
              }
            }}
          >
            Dodaj preostali razpored
          </button>
        )}
        {canEdit && (
          <button
            className="ghost"
            type="button"
            title="CSV s stolpci kolo, datum, ura, domači, gostje. Doda tekme k sezoni."
            onClick={() => csvRef.current?.click()}
          >
            Uvozi razpored (CSV)
          </button>
        )}
        <button
          className="ghost"
          type="button"
          title="Naloži prej izvožen JSON. Če sezona z istim imenom že obstaja, vpraša za prepis ali novo ime."
          onClick={() => fileRef.current?.click()}
        >
          Uvozi JSON kot sezono
        </button>
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
              const imported = next.seasonTitle?.trim() || "Uvožena sezona";
              let title = imported;
              for (;;) {
                const dup = findSeasonByName(seasons, title, seasonId);
                if (!dup) {
                  await importSeason({ ...next, seasonTitle: title });
                  break;
                }
                const overwrite = window.confirm(
                  `Sezona „${dup.label}“ že obstaja.\n\nV redu — prepiši obstoječo sezono.\nPrekliči — shrani uvoz pod drugim imenom.`,
                );
                if (overwrite) {
                  await replaceSeason(dup.id, { ...next, seasonTitle: dup.label });
                  break;
                }
                const typed = window.prompt("Novo ime za uvoženo sezono:", `${title} (2)`);
                if (typed == null) break;
                title = typed.trim() || `${title} (2)`;
              }
            } catch {
              window.alert("Datoteka ni veljaven izvoz lige.");
            }
          }}
        />
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const parsed = parseScheduleCsv(await file.text());
              if (parsed.error) throw new Error(parsed.error);
              importFixtures(parsed.rows);
            } catch (err) {
              window.alert(err instanceof Error ? err.message : "CSV ni veljaven razpored.");
            }
          }}
        />
        <p className="muted admin-menu-hint">
          {remote
            ? "Sezone se shranjujejo na strežnik — vsi vidijo isto."
            : "Zdaj so sezone samo v tem brskalniku. Pred vklopom baze nujno Izvozi JSON, sicer se lanski vnosi ne prenesejo."}{" "}
          JSON je varnostna kopija cele sezone. CSV: kolo, datum, ura, domači, gostje, opomba.
        </p>
      </div>
      )}
    </div>
  );
}
