import { useEffect, useRef, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { Teams } from "./pages/Teams";
import { Login } from "./pages/Login";
import { exportStandingsPdf } from "./lib/exportPdf";
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
    seasonLabel,
    seasons,
    resetDemo,
    loadSeason2025,
    newEmptySeason,
    importState,
    loadSeason,
    archiveSeason,
  } = useStore();
  const canEdit = admin && !archived;
  const [page, setPage] = useState<Page>("schedule");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const go = (next: Page) => {
    setPage(next);
    setMatchId(null);
    setTeamId(null);
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
        {remote && seasons.length > 0 && (
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
        {page === "results" && !matchId && <Matches mode="results" onOpen={setMatchId} />}
        {(page === "schedule" || page === "results") && matchId && (
          <MatchEntry
            matchId={matchId}
            onBack={() => setMatchId(null)}
            readOnly={!canEdit}
          />
        )}
        {page === "standings" && <Standings />}
        {page === "players" && <PlayerStandings />}
        {canEdit && page === "teams" && !teamId && <Teams onOpen={setTeamId} />}
        {canEdit && page === "teams" && teamId && (
          <TeamDetail teamId={teamId} onBack={() => setTeamId(null)} />
        )}

        {admin && (
        <details className="admin-box">
          <summary>Urejanje sezone{remote ? ` · ${seasonLabel}` : ""}</summary>
          <div className="row-actions">
            <button
              className="ghost"
              type="button"
              disabled={exportingPdf}
              onClick={async () => {
                setExportingPdf(true);
                try {
                  await exportStandingsPdf(state);
                } finally {
                  setExportingPdf(false);
                }
              }}
            >
              {exportingPdf ? "Pripravljam PDF…" : "Izvozi PDF"}
            </button>
            {canEdit && (
            <>
            <button className="ghost" onClick={resetDemo}>
              Napolni sezono 2026/27
            </button>
            <button className="ghost" onClick={loadSeason2025}>
              Napolni testno sezono 2025/26
            </button>
            </>
            )}
            <button
              className="ghost"
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
              Izvozi podatke
            </button>
            {canEdit && (
            <button className="ghost" onClick={() => fileRef.current?.click()}>
              Uvozi podatke
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
            {canEdit && (
              <button className="danger" onClick={newEmptySeason}>
                Prazna sezona
              </button>
            )}
            {canEdit && remote && (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  if (window.confirm("Trenutno sezono arhiviraš in začneš prazno novo?")) {
                    void archiveSeason();
                  }
                }}
              >
                Arhiviraj sezono
              </button>
            )}
          </div>
        </details>
        )}
      </div>
    </div>
  );
}
