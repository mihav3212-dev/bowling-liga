import { useEffect, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { Teams } from "./pages/Teams";
import { Login } from "./pages/Login";
import { ThemePicker } from "./pages/ThemePicker";
import { AdminMenu } from "./pages/AdminMenu";
import { PdfButton } from "./pages/PdfButton";
import { exportPlayersPdf, exportResultsPdf, exportStandingsPdf } from "./lib/exportPdf";
import { useAuth } from "./lib/auth";
import { publicSeasonId } from "./lib/storage";
import { useStore } from "./lib/store";

type Page = "schedule" | "results" | "standings" | "players" | "teams";

export function App() {
  const { admin } = useAuth();
  const {
    state,
    archived,
    newEmptySeason,
    openTrainingSeason,
    seasons,
    seasonId,
    seasonLabel,
    loadSeason,
    renameSeason,
    deleteSeason,
  } = useStore();
  const canEdit = admin && !archived;
  const shownSeasons = admin ? seasons : seasons.filter((s) => !s.training);
  const training = Boolean(state.training || seasons.find((s) => s.id === seasonId)?.training);
  const [page, setPage] = useState<Page>("schedule");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const go = (next: Page) => {
    setPage(next);
    setMatchId(null);
    setTeamId(null);
  };

  const startNewSeason = async () => {
    const title = window.prompt("Ime nove sezone (npr. 2027/2028)", "");
    if (title == null) return;
    const name = title.trim() || "Nova sezona";
    await newEmptySeason(name);
    go("teams");
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
        `Izbrišem sezono „${seasonLabel}“? Ekipe, razpored in rezultati te sezone bodo izgubljeni.`,
      )
    ) {
      return;
    }
    try {
      await deleteSeason(seasonId);
      go("schedule");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Sezone ni bilo mogoče izbrisati.");
    }
  };

  useEffect(() => {
    if (!canEdit) {
      setTeamId(null);
      if (page === "teams") setPage("schedule");
      if (!admin && page === "schedule") setMatchId(null);
    }
  }, [admin, canEdit, page]);

  useEffect(() => {
    if (admin || !training) return;
    const id = publicSeasonId(seasons, seasonId);
    if (id && id !== seasonId) void loadSeason(id);
  }, [admin, training, seasons, seasonId, loadSeason]);

  return (
    <div>
      <header className="site-header">
        <a href="https://bowlinglenart.si/" aria-label="Bowling Lenart">
          <img className="logo" src="/logo-bowling-lenart.png" alt="Bowling Lenart" />
        </a>
        <div className="header-actions">
          {admin && (
            <AdminMenu
              canEdit={canEdit}
              onNewSeason={() => void startNewSeason()}
              onTrainingSeason={async () => {
                await openTrainingSeason();
                go("teams");
              }}
            />
          )}
          <Login />
          <ThemePicker />
        </div>
      </header>

      <div className={page === "players" ? "app-shell is-wide" : "app-shell"}>
        <h1 className="page-title">Bowling liga Lenart.</h1>
        {shownSeasons.length > 0 && (
          <div className="season-bar">
            <label>
              Sezona
              <select
                value={shownSeasons.some((s) => s.id === seasonId) ? (seasonId ?? "") : ""}
                onChange={(e) => {
                  if (e.target.value) void loadSeason(e.target.value);
                }}
              >
                {shownSeasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.label}
                    {season.training ? " (trening)" : ""}
                    {season.archived ? " (arhiv)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {archived && <span className="muted">Arhiv — samo branje.</span>}
            {admin && (
              <span className="season-bar-actions">
                <button className="ghost" type="button" onClick={() => void renameCurrentSeason()}>
                  Preimenuj
                </button>
                <button
                  className="ghost"
                  type="button"
                  disabled={seasons.length <= 1}
                  title={seasons.length <= 1 ? "Zadnje sezone ni mogoče izbrisati." : "Trajno odstrani izbrano sezono."}
                  onClick={() => void deleteCurrentSeason()}
                >
                  Izbriši
                </button>
              </span>
            )}
            {training && admin && (
              <span className="season-note" style={{ margin: 0 }}>
                Trening — vidiš samo prijavljeni, obiskovalci tega ne vidijo.
              </span>
            )}
          </div>
        )}
        <nav className="liga-tabs">
          {(
            [
              ["schedule", "Razpored"],
              ["results", "Rezultati"],
              ["standings", "Lestvica"],
              ["players", "Igralci"],
              ...(canEdit ? [["teams", "Ekipe"] as [Page, string]] : []),
            ] as [Page, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={page === id && !matchId && !teamId ? "active" : ""}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {page === "schedule" && !matchId && (
          <Matches mode="schedule" onOpen={canEdit ? setMatchId : undefined} />
        )}
        {page === "results" && !matchId && (
          <>
            <Matches mode="results" onOpen={setMatchId} />
            <PdfButton label="Izvozi PDF rezultatov" onExport={() => exportResultsPdf(state)} />
          </>
        )}
        {(page === "schedule" || page === "results") && matchId && (
          <MatchEntry
            matchId={matchId}
            onBack={() => setMatchId(null)}
            readOnly={!canEdit}
          />
        )}
        {page === "standings" && (
          <>
            <Standings />
            <PdfButton label="Izvozi PDF lestvice" onExport={() => exportStandingsPdf(state)} />
          </>
        )}
        {page === "players" && (
          <>
            <PlayerStandings />
            <PdfButton label="Izvozi PDF igralcev" onExport={() => exportPlayersPdf(state)} />
          </>
        )}
        {canEdit && page === "teams" && !teamId && <Teams onOpen={setTeamId} />}
        {canEdit && page === "teams" && teamId && (
          <TeamDetail teamId={teamId} onBack={() => setTeamId(null)} />
        )}
      </div>
    </div>
  );
}
