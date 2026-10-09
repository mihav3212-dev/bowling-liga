import { useEffect, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { Teams } from "./pages/Teams";
import { Login } from "./pages/Login";
import { AdminMenu } from "./pages/AdminMenu";
import { PdfButton } from "./pages/PdfButton";
import { exportPlayersPdf, exportResultsPdf, exportStandingsPdf } from "./lib/exportPdf";
import { useAuth } from "./lib/auth";
import { useStore } from "./lib/store";

type Page = "schedule" | "results" | "standings" | "players" | "teams";

export function App() {
  const { admin } = useAuth();
  const { state, archived, archiveSeason, seasons, seasonId, loadSeason } = useStore();
  const canEdit = admin && !archived;
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
    if (
      !window.confirm(
        "Trenutno sezono arhiviraš (ostane za ogled). Nova bo prazna — ekipe in razpored dodaš na zavihku Ekipe.",
      )
    ) {
      return;
    }
    await archiveSeason(name);
    go("teams");
  };

  useEffect(() => {
    if (!canEdit) {
      setTeamId(null);
      if (page === "teams") setPage("schedule");
      if (!admin && page === "schedule") setMatchId(null);
    }
  }, [admin, canEdit, page]);

  return (
    <div>
      <header className="site-header">
        <a href="https://bowlinglenart.si/" aria-label="Bowling Lenart">
          <img className="logo" src="/logo-bowling-lenart.png" alt="Bowling Lenart" />
        </a>
        <div className="header-actions">
          {admin && <AdminMenu canEdit={canEdit} onNewSeason={() => void startNewSeason()} />}
          <Login />
        </div>
      </header>

      <div className="app-shell">
        <h1 className="page-title">Bowling liga Lenart.</h1>
        {seasons.length > 0 && (
          <div className="season-bar">
            <label>
              Sezona
              <select
                value={seasonId ?? ""}
                onChange={(e) => {
                  if (e.target.value) void loadSeason(e.target.value);
                }}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.label}
                    {season.archived ? " (arhiv)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {archived && <span className="muted">Arhiv — samo branje.</span>}
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
