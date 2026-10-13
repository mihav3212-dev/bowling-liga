import { useEffect, useRef, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { TeamAccess } from "./pages/TeamAccess";
import { Teams } from "./pages/Teams";
import { Training } from "./pages/Training";
import { Login } from "./pages/Login";
import { ThemePicker } from "./pages/ThemePicker";
import { AdminMenu } from "./pages/AdminMenu";
import { Setup } from "./pages/Setup";
import { PdfButton } from "./pages/PdfButton";
import { exportPlayersPdf, exportResultsPdf, exportStandingsPdf } from "./lib/exportPdf";
import { useAuth } from "./lib/auth";
import { publicSeasonId } from "./lib/storage";
import { canOpenTeamMatch, canTeam, teamPerms } from "./lib/access";
import { useStore } from "./lib/store";

type Page = "schedule" | "results" | "standings" | "players" | "teams" | "training" | "access";

export function App() {
  const { admin, teamId: loginTeamId, teamName } = useAuth();
  const {
    state,
    archived,
    newEmptySeason,
    seasons,
    seasonId,
    loadSeason,
  } = useStore();
  const canEdit = admin && !archived;
  const loginTeam = state.teams.find((team) => team.id === loginTeamId);
  const teamCaps = teamPerms(loginTeam);
  const shownSeasons = admin ? seasons : seasons.filter((s) => !s.training);
  const training = Boolean(state.training || seasons.find((s) => s.id === seasonId)?.training);
  const [page, setPage] = useState<Page>("schedule");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<string | null>(null);
  const [trainingSessionId, setTrainingSessionId] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const prevLoginTeam = useRef<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("liga-skip-setup")) {
      setSetupNeeded(false);
      return;
    }
    fetch("/api/setup")
      .then((res) => res.json())
      .then((data: { needed?: boolean }) => setSetupNeeded(Boolean(data.needed)))
      .catch(() => setSetupNeeded(false));
  }, []);

  const go = (next: Page) => {
    setPage(next);
    setMatchId(null);
    setDetailTeamId(null);
  };

  const startNewSeason = async () => {
    const title = window.prompt("Ime nove sezone (npr. 2027/2028)", "");
    if (title == null) return;
    const name = title.trim() || "Nova sezona";
    await newEmptySeason(name);
    go("teams");
  };

  useEffect(() => {
    if (page === "training") setPage("teams");
    if (canEdit) return;
    if (page === "access") setPage("schedule");
    if (page === "teams" && !loginTeamId) {
      setPage("schedule");
      setDetailTeamId(null);
    }
    if (!admin && !loginTeamId && page === "schedule") setMatchId(null);
  }, [admin, canEdit, loginTeamId, page]);

  useEffect(() => {
    if (admin || !training) return;
    const id = publicSeasonId(seasons, seasonId);
    if (id && id !== seasonId) void loadSeason(id);
  }, [admin, training, seasons, seasonId, loadSeason]);

  useEffect(() => {
    if (!prevLoginTeam.current && loginTeamId) go("schedule");
    prevLoginTeam.current = loginTeamId;
  }, [loginTeamId]);

  const legacyTraining = training && admin;

  if (setupNeeded === null) return null;
  if (setupNeeded) {
    return (
      <div>
        <header className="site-header">
          <a href="https://bowlinglenart.si/" aria-label="Bowling Lenart">
            <img className="logo" src="/logo-bowling-lenart.png" alt="Bowling Lenart" />
          </a>
          <div className="header-actions">
            <ThemePicker />
          </div>
        </header>
        <Setup onDone={() => window.location.reload()} onSkip={() => setSetupNeeded(false)} />
      </div>
    );
  }

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
              onAccess={() => go("access")}
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
            {loginTeamId && (
              <span className="season-note" style={{ margin: 0 }}>
                Prijava ekipe{teamName ? `: ${teamName}` : ""}. Dovoljenja nastavi admin.
              </span>
            )}
          </div>
        )}
        {legacyTraining ? (
          <Training
            sessionId={trainingSessionId}
            ownerTeamId={null}
            canPickTeam={false}
            onOpen={setTrainingSessionId}
            onBack={() => setTrainingSessionId(null)}
          />
        ) : (
          <>
        <nav className="liga-tabs">
          {(
            [
              ["schedule", "Razpored"],
              ["results", "Rezultati"],
              ["standings", "Lestvica"],
              ["players", "Igralci"],
              ...(canEdit || Boolean(loginTeamId) ? [["teams", "Ekipe"] as [Page, string]] : []),
            ] as [Page, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={page === id && !matchId && !detailTeamId ? "active" : ""}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {page === "schedule" && !matchId && (
          <Matches
            mode="schedule"
            onOpen={canEdit || canOpenTeamMatch(loginTeam) ? setMatchId : undefined}
            canOpen={
              canEdit
                ? undefined
                : (match) =>
                    Boolean(
                      loginTeamId &&
                        (match.homeTeamId === loginTeamId || match.awayTeamId === loginTeamId) &&
                        canOpenTeamMatch(loginTeam),
                    )
            }
          />
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
            readOnly={!canEdit && !loginTeamId}
            lineupTeamId={canEdit ? null : loginTeamId}
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
        {page === "access" && canEdit && <TeamAccess />}
        {(canEdit || teamCaps.season) && page === "teams" && !detailTeamId && (
          <Teams onOpen={setDetailTeamId} />
        )}
        {(canEdit || teamCaps.season) && page === "teams" && detailTeamId && (
          <TeamDetail
            teamId={detailTeamId}
            onBack={() => setDetailTeamId(null)}
            canManage={canEdit}
            canRoster={canEdit || canTeam(loginTeam, "roster")}
            showTraining={canEdit || detailTeamId === loginTeamId}
          />
        )}
        {Boolean(loginTeamId) && !teamCaps.season && !canEdit && page === "teams" && (
          <TeamDetail
            teamId={loginTeamId!}
            onBack={() => go("schedule")}
            backLabel="← Razpored"
            canManage={false}
            canRoster={canTeam(loginTeam, "roster")}
          />
        )}
          </>
        )}
      </div>
    </div>
  );
}
