import { useEffect, useRef, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { Teams } from "./pages/Teams";
import { Login } from "./pages/Login";
import { PdfButton } from "./pages/PdfButton";
import { exportPlayersPdf, exportResultsPdf, exportStandingsPdf } from "./lib/exportPdf";
import { useAuth } from "./lib/auth";
import { useStore } from "./lib/store";
import type { LeagueState } from "./lib/types";

type Page = "schedule" | "results" | "standings" | "players" | "teams";

export function App() {
  const { admin } = useAuth();
  const {
    state,
    remote,
    archived,
    seasonId,
    seasons,
    newEmptySeason,
    importState,
    loadSeason,
    archiveSeason,
  } = useStore();
  const canEdit = admin && !archived;
  const [page, setPage] = useState<Page>("schedule");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const go = (next: Page) => {
    setPage(next);
    setMatchId(null);
    setTeamId(null);
  };

  const startNewSeason = async () => {
    const title = window.prompt("Ime nove sezone (npr. 2027/2028)", "");
    if (title == null) return;
    const name = title.trim() || "Nova sezona";
    if (remote) {
      if (
        !window.confirm(
          "Trenutno sezono arhiviraš. Nova bo prazna — ekipe in razpored dodaš na zavihku Ekipe.",
        )
      ) {
        return;
      }
      await archiveSeason(name);
    } else if (state.teams.length > 0 || state.matches.length > 0) {
      if (!window.confirm("Briše ekipe in tekme v tem brskalniku in začne prazno sezono.")) {
        return;
      }
      newEmptySeason(name);
    } else {
      newEmptySeason(name);
    }
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
          <Login />
        </div>
      </header>

      <div className="app-shell">
        <h1 className="page-title">Bowling liga Lenart.</h1>
        {(admin || (remote && seasons.length > 0)) && (
          <div className="season-bar">
            {remote && seasons.length > 0 && (
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
            )}
            {archived && <span className="muted">Arhiv — samo branje.</span>}
            {canEdit && (
              <button className="primary" type="button" onClick={() => void startNewSeason()}>
                Nova sezona
              </button>
            )}
            {admin && (
              <>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(state, null, 2)], {
                      type: "application/json",
                    });
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
                {canEdit && (
                  <button className="ghost" type="button" onClick={() => fileRef.current?.click()}>
                    Uvozi JSON
                  </button>
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
                      importState(next);
                    } catch {
                      window.alert("Datoteka ni veljaven izvoz lige.");
                    }
                  }}
                />
              </>
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
