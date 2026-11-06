import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { exportLastRoundBackup } from "../lib/exportPdf";
import { formatInviteCode, newInviteToken } from "../lib/invite";
import { getDisplayPasswordStatus, setDisplayPassword } from "../lib/leagueApi";
import { remainingOfficialRounds, parseScheduleCsv } from "../lib/schedule";
import { seasonIsComplete } from "../lib/scoring";
import { lastCompletedRound } from "../lib/standings";
import { useStore } from "../lib/store";
import { findSeasonByName } from "../lib/storage";
import type { LeagueState } from "../lib/types";
import { AddMatchDialog } from "./AddMatchDialog";
import { DeleteMatchDialog } from "./DeleteMatchDialog";
import { RescheduleMatchDialog } from "./RescheduleMatchDialog";
import { SeasonSnapshotsDialog } from "./SeasonSnapshotsDialog";
import { SwapMatchHomeAwayDialog } from "./SwapMatchHomeAwayDialog";
import { SwapMatchTimesDialog } from "./SwapMatchTimesDialog";

export function AdminMenu({
  canEdit,
  onNewSeason,
  onAccess,
}: {
  canEdit: boolean;
  onNewSeason: () => void;
  onAccess: () => void;
}) {
  const {
    state,
    remote,
    archived,
    seasons,
    seasonId,
    seasonLabel,
    importSeason,
    replaceSeason,
    importFixtures,
    appendOfficialSchedule,
    closeSeason,
    reopenSeason,
    renameSeason,
    deleteSeason,
  } = useStore();
  const complete = seasonIsComplete(state);
  const leftover = remainingOfficialRounds(state);
  const lastRound = lastCompletedRound(state);
  const { logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"home" | "seasons" | "edit" | "tv">("home");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapHomeAwayOpen, setSwapHomeAwayOpen] = useState(false);
  const [deleteMatchOpen, setDeleteMatchOpen] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [tvBusy, setTvBusy] = useState(false);
  const [hasTvPassword, setHasTvPassword] = useState(false);
  const [tvCode, setTvCode] = useState("");
  const [tvManual, setTvManual] = useState("");
  const [tvNote, setTvNote] = useState("");

  const closeMenu = () => {
    setOpen(false);
    setPanel("home");
    setTvCode("");
    setTvManual("");
    setTvNote("");
  };

  useEffect(() => {
    if (!open || panel !== "tv" || !remote) return;
    let cancelled = false;
    getDisplayPasswordStatus()
      .then((s) => {
        if (!cancelled) setHasTvPassword(s.hasDisplayPassword);
      })
      .catch(() => {
        if (!cancelled) setHasTvPassword(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, panel, remote]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        rescheduleOpen ||
        swapOpen ||
        swapHomeAwayOpen ||
        deleteMatchOpen ||
        addMatchOpen ||
        snapshotsOpen
      ) {
        return;
      }
      if (panel === "edit") setPanel("seasons");
      else if (panel === "seasons" || panel === "tv") setPanel("home");
      else closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    open,
    panel,
    rescheduleOpen,
    swapOpen,
    swapHomeAwayOpen,
    deleteMatchOpen,
    addMatchOpen,
    snapshotsOpen,
  ]);

  const downloadSeasonJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    const safe = seasonLabel.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 40);
    a.download = `backupbowlingliga_${safe || "sezona"}_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renameCurrentSeason = async () => {
    if (!seasonId) return;
    const typed = window.prompt("Novo ime sezone", seasonLabel);
    if (typed == null) return;
    const name = typed.trim();
    if (!name || name === seasonLabel) return;
    const dup = seasons.find((s) => s.id !== seasonId && s.label.trim().toLowerCase() === name.toLowerCase());
    if (dup && !window.confirm(`Sezona „${dup.label}“ že obstaja. Vseeno preimenujem?`)) return;
    try {
      await renameSeason(seasonId, name);
    } catch {
      window.alert("Sezone ni bilo mogoče preimenovati.");
    }
  };

  const deleteCurrentSeason = async () => {
    if (!seasonId) return;
    if (seasons.length <= 1) {
      window.alert("Zadnje sezone ni mogoče izbrisati.");
      return;
    }
    if (
      !window.confirm(
        `Pred brisanjem snamem JSON kopijo sezone „${seasonLabel}“. Nadaljujem?`,
      )
    ) {
      return;
    }
    downloadSeasonJson();
    if (
      !window.confirm(
        `JSON je prenesen. Res zbrišem sezono „${seasonLabel}“? Kasneje jo lahko uvoziš nazaj z Uvozi JSON.`,
      )
    ) {
      return;
    }
    try {
      await deleteSeason(seasonId);
      closeMenu();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Sezone ni bilo mogoče izbrisati.");
    }
  };

  return (
    <>
    <div className="admin-menu">
      <button
        className="ghost header-admin"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          if (open) closeMenu();
          else setOpen(true);
        }}
      >
        Admin
      </button>
      {open && (
        <button
          className="admin-menu-backdrop"
          type="button"
          aria-label="Zapri meni"
          onClick={closeMenu}
        />
      )}
      {open && (
      <div className="admin-menu-panel">
        {panel === "home" && (
          <>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                closeMenu();
                onAccess();
              }}
            >
              Dovoljenja ekip
            </button>
            <button className="ghost" type="button" onClick={() => setPanel("tv")}>
              TV / bowling ekran
            </button>
            <button className="primary" type="button" onClick={() => setPanel("seasons")}>
              Urejaj sezone
            </button>
            <button className="ghost" type="button" onClick={() => void logout()}>
              Odjava
            </button>
          </>
        )}
        {panel === "tv" && (
          <>
            <button className="ghost admin-menu-back" type="button" onClick={() => setPanel("home")}>
              Nazaj
            </button>
            <p className="muted admin-menu-current">TV / bowling ekran</p>
            {!remote ? (
              <p className="muted admin-menu-hint">
                TV geslo deluje, ko je vklopljena skupna baza (MySQL / hosting).
              </p>
            ) : (
              <>
                <p className="muted admin-menu-hint">
                  Ustvari geslo in ga vpiši na TV (polje zgoraj desno). Potem odpri{" "}
                  <strong>TV živo</strong> ali <strong>TV liga</strong>.{" "}
                  {hasTvPassword
                    ? "Geslo je nastavljeno (vrednosti admin ne vidi nazaj)."
                    : "Geslo še ni nastavljeno."}
                </p>
                <div className="row-actions" style={{ marginBottom: 8 }}>
                  <button
                    className="primary"
                    type="button"
                    disabled={tvBusy}
                    onClick={async () => {
                      setTvBusy(true);
                      setTvNote("");
                      try {
                        const token = newInviteToken();
                        await setDisplayPassword(token);
                        const code = formatInviteCode(token);
                        setTvCode(code);
                        setHasTvPassword(true);
                        try {
                          await navigator.clipboard.writeText(code);
                          setTvNote("Geslo je v odložišču — vpiši ga na TV.");
                        } catch {
                          setTvNote("Skopiraj geslo in ga vpiši na TV.");
                        }
                      } catch {
                        window.alert("Gesla ni bilo mogoče shraniti.");
                      } finally {
                        setTvBusy(false);
                      }
                    }}
                  >
                    {tvBusy ? "…" : hasTvPassword || tvCode ? "Novo geslo" : "Ustvari TV geslo"}
                  </button>
                  {tvCode && (
                    <button
                      className="ghost"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tvCode);
                          setTvNote("Geslo je v odložišču.");
                        } catch {
                          setTvNote("Označi geslo in ga skopiraj.");
                        }
                      }}
                    >
                      Kopiraj
                    </button>
                  )}
                </div>
                {tvCode && (
                  <p className="invite-code-block" aria-label="TV geslo">
                    <span className="muted">Geslo</span>
                    <strong className="invite-code">{tvCode}</strong>
                  </p>
                )}
                {tvNote && <p className="muted">{tvNote}</p>}
                <p className="muted" style={{ marginTop: 8 }}>
                  Ali vpiši svoje geslo:
                </p>
                <form
                  className="form-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const pw = tvManual.trim();
                    if (!pw) return;
                    setTvBusy(true);
                    try {
                      await setDisplayPassword(pw);
                      setHasTvPassword(true);
                      setTvCode(pw.length === 8 ? formatInviteCode(pw) : pw);
                      setTvManual("");
                      setTvNote("Geslo shranjeno.");
                    } catch {
                      window.alert("Gesla ni bilo mogoče shraniti.");
                    } finally {
                      setTvBusy(false);
                    }
                  }}
                >
                  <input
                    type="password"
                    value={tvManual}
                    onChange={(e) => setTvManual(e.target.value)}
                    placeholder={hasTvPassword ? "Novo TV geslo" : "TV geslo"}
                    autoComplete="new-password"
                  />
                  <button className="primary" type="submit" disabled={tvBusy || !tvManual.trim()}>
                    {tvBusy ? "…" : "Nastavi"}
                  </button>
                </form>
                {hasTvPassword && (
                  <button
                    className="danger"
                    type="button"
                    disabled={tvBusy}
                    style={{ marginTop: 8 }}
                    onClick={async () => {
                      if (!window.confirm("Odstranim TV geslo? Prijava na ekranu ne bo več delovala.")) {
                        return;
                      }
                      setTvBusy(true);
                      try {
                        await setDisplayPassword("");
                        setHasTvPassword(false);
                        setTvCode("");
                        setTvNote("TV geslo odstranjeno.");
                      } catch {
                        window.alert("Gesla ni bilo mogoče odstraniti.");
                      } finally {
                        setTvBusy(false);
                      }
                    }}
                  >
                    Odstrani geslo
                  </button>
                )}
              </>
            )}
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button
                className="ghost"
                type="button"
                onClick={() => window.open("/?display=live", "_blank", "noopener,noreferrer")}
              >
                Odpri TV živo
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => window.open("/?display=board", "_blank", "noopener,noreferrer")}
              >
                Odpri TV liga
              </button>
            </div>
          </>
        )}
        {panel === "seasons" && (
          <>
            <button className="ghost admin-menu-back" type="button" onClick={() => setPanel("home")}>
              Nazaj
            </button>
            <p className="muted admin-menu-current">
              {seasonLabel}
              {state.training ? " (trening)" : ""}
              {archived ? " — arhiv, samo branje" : ""}
            </p>
            <button
              className="primary"
              type="button"
              onClick={() => {
                closeMenu();
                onNewSeason();
              }}
            >
              Nova sezona
            </button>
            <button className="ghost" type="button" onClick={() => setPanel("edit")}>
              Urejaj obstoječo
            </button>
            <button
              className="ghost"
              type="button"
              disabled={lastRound <= 0 || backupBusy}
              title={
                lastRound <= 0
                  ? "Še ni končanega kola z rezultati."
                  : `ZIP: PDF-ji tekem ${lastRound}. kola, lestvica, igralci + JSON sezone.`
              }
              onClick={() => {
                setBackupBusy(true);
                void exportLastRoundBackup(state)
                  .then((round) => {
                    if (round == null) {
                      window.alert("Še ni končanega kola z rezultati.");
                    }
                  })
                  .catch((err) => {
                    window.alert(err instanceof Error ? err.message : "Varnostne kopije ni bilo mogoče pripraviti.");
                  })
                  .finally(() => setBackupBusy(false));
              }}
            >
              {backupBusy
                ? "Pripravljam kopijo…"
                : lastRound > 0
                  ? `Izvozi varnostno kopijo ${lastRound}. kola`
                  : "Izvozi varnostno kopijo kola"}
            </button>
          </>
        )}
        {panel === "edit" && (
          <>
            <button className="ghost admin-menu-back" type="button" onClick={() => setPanel("seasons")}>
              Nazaj
            </button>
            <p className="muted admin-menu-current">
              {seasonLabel}
              {state.training ? " (trening)" : ""}
              {archived ? " — arhiv, samo branje" : ""}
            </p>
            <button className="ghost" type="button" onClick={() => void renameCurrentSeason()}>
              Preimenuj
            </button>
            <button
              className="ghost"
              type="button"
              title="Avtomatske kopije po koncu kola (zadnjih 10) in ročna točka."
              onClick={() => {
                setSnapshotsOpen(true);
                setOpen(false);
              }}
            >
              Obnovitvene točke
            </button>
            {canEdit && (
              <button
                className="ghost"
                type="button"
                disabled={state.matches.length < 1}
                title={
                  state.matches.length < 1
                    ? "Najprej mora biti razpored s tekmami."
                    : "Prestavi eno tekmo na nov datum/uro."
                }
                onClick={() => {
                  setRescheduleOpen(true);
                  setOpen(false);
                }}
              >
                Spremeni termin
              </button>
            )}
            {canEdit && (
              <button
                className="ghost"
                type="button"
                disabled={state.matches.length < 2}
                title={
                  state.matches.length < 2
                    ? "Najprej mora biti razpored s tekmami."
                    : "Zamenjaj datum/uro dveh tekem."
                }
                onClick={() => {
                  setSwapOpen(true);
                  setOpen(false);
                }}
              >
                Zamenjaj termin
              </button>
            )}
            {canEdit && (
              <button
                className="ghost"
                type="button"
                disabled={state.matches.length < 1}
                title={
                  state.matches.length < 1
                    ? "Najprej mora biti razpored s tekmami."
                    : "Zamenjaj, kdo je domačin in kdo gost."
                }
                onClick={() => {
                  setSwapHomeAwayOpen(true);
                  setOpen(false);
                }}
              >
                Zamenjaj domačin/gost
              </button>
            )}
            {canEdit && (
              <button
                className="ghost"
                type="button"
                disabled={state.teams.length < 2}
                title={
                  state.teams.length < 2
                    ? "Najprej dodaj vsaj dve ekipi."
                    : "Vstavi eno tekmo v razpored (npr. nadomestna)."
                }
                onClick={() => {
                  setAddMatchOpen(true);
                  setOpen(false);
                }}
              >
                Dodaj tekmo
              </button>
            )}
            {canEdit && (
              <button
                className="ghost"
                type="button"
                disabled={state.matches.length < 1}
                title={
                  state.matches.length < 1
                    ? "Najprej mora biti razpored s tekmami."
                    : "Odstrani tekmo iz razporeda (npr. ekipa ni igrala)."
                }
                onClick={() => {
                  setDeleteMatchOpen(true);
                  setOpen(false);
                }}
              >
                Izbriši tekmo
              </button>
            )}
            {archived && (
              <button className="ghost" type="button" onClick={() => void reopenSeason()}>
                Odpri sezono
              </button>
            )}
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
              title="Samo JSON sezone (ekipe, igralci, razpored, rezultati) — brez PDF-jev. S tem lahko sezono kasneje uvoziš nazaj."
              onClick={() => downloadSeasonJson()}
            >
              Izvozi JSON
            </button>
            <button
              className="ghost"
              type="button"
              title="Naloži prej izvožen JSON. Če sezona z istim imenom že obstaja, vpraša za prepis ali novo ime."
              onClick={() => fileRef.current?.click()}
            >
              Uvozi JSON
            </button>
            {canEdit && (
              <button
                className="ghost"
                type="button"
                title="CSV s stolpci kolo/krog, datum, ura, domači, gostje. Doda tekme k sezoni."
                onClick={() => csvRef.current?.click()}
              >
                Uvozi CSV
              </button>
            )}
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
            <button
              className="ghost"
              type="button"
              disabled={seasons.length <= 1}
              title={seasons.length <= 1 ? "Zadnje sezone ni mogoče izbrisati." : "Trajno odstrani izbrano sezono."}
              onClick={() => void deleteCurrentSeason()}
            >
              Izbriši sezono
            </button>
            <p className="muted admin-menu-hint">
              {remote
                ? "Sezone se shranjujejo na strežnik — vsi vidijo isto."
                : "Zdaj so sezone samo v tem brskalniku. Pred vklopom baze nujno Izvozi JSON, sicer se lanski vnosi ne prenesejo."}{" "}
              Izvozi JSON = kopija baze. Varnostna kopija kola (zgoraj) vključuje tudi PDF-je. CSV: kolo, datum, ura, domači, gostje, opomba.
            </p>
          </>
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
      </div>
      )}
    </div>
    {rescheduleOpen && <RescheduleMatchDialog onClose={() => setRescheduleOpen(false)} />}
    {swapOpen && <SwapMatchTimesDialog onClose={() => setSwapOpen(false)} />}
    {swapHomeAwayOpen && <SwapMatchHomeAwayDialog onClose={() => setSwapHomeAwayOpen(false)} />}
    {addMatchOpen && <AddMatchDialog onClose={() => setAddMatchOpen(false)} />}
    {deleteMatchOpen && <DeleteMatchDialog onClose={() => setDeleteMatchOpen(false)} />}
    {snapshotsOpen && <SeasonSnapshotsDialog onClose={() => setSnapshotsOpen(false)} />}
    </>
  );
}
