import { useEffect, useRef, useState } from "react";
import { MatchEntry } from "./pages/MatchEntry";
import { Matches } from "./pages/Matches";
import { Standings } from "./pages/Standings";
import { PlayerStandings } from "./pages/PlayerStandings";
import { TeamDetail } from "./pages/TeamDetail";
import { TeamAccess } from "./pages/TeamAccess";
import { Teams } from "./pages/Teams";
import { AdminTraining } from "./pages/AdminTraining";
import { Training } from "./pages/Training";
import { ClaimInvite } from "./pages/ClaimInvite";
import { Login } from "./pages/Login";
import { AdminMenu } from "./pages/AdminMenu";
import { Setup } from "./pages/Setup";
import { PdfButton } from "./pages/PdfButton";
import { LiveMatchBoard, LiveMatchDisplay } from "./pages/LiveMatchDisplay";
import { MatchResultView } from "./pages/MatchResultView";
import { MatchResultPage } from "./pages/MatchResultPage";
import { NewSeasonDialog } from "./pages/NewSeasonDialog";
import { exportResultsPdf } from "./lib/exportPdf";
import { useAuth } from "./lib/auth";
import { publicSeasonId } from "./lib/storage";
import { canOpenTeamMatch, canTeam, teamPerms } from "./lib/access";
import { useStore } from "./lib/store";

type Page = "schedule" | "results" | "standings" | "players" | "teams" | "training" | "access";

const PAGE_SET = new Set<Page>([
  "schedule",
  "results",
  "standings",
  "players",
  "teams",
  "training",
  "access",
]);

type NavState = {
  page: Page;
  matchId: string | null;
  detailTeamId: string | null;
  trainingSessionId: string | null;
};

function readNavFromUrl(): NavState {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("page");
  const page = raw && PAGE_SET.has(raw as Page) ? (raw as Page) : "schedule";
  return {
    page,
    matchId: q.get("match"),
    detailTeamId: q.get("team"),
    trainingSessionId: q.get("training"),
  };
}

function buildNavUrl(nav: NavState): string {
  const url = new URL(window.location.href);
  if (nav.page && nav.page !== "schedule") url.searchParams.set("page", nav.page);
  else url.searchParams.delete("page");
  if (nav.matchId) url.searchParams.set("match", nav.matchId);
  else url.searchParams.delete("match");
  if (nav.detailTeamId) url.searchParams.set("team", nav.detailTeamId);
  else url.searchParams.delete("team");
  if (nav.trainingSessionId) url.searchParams.set("training", nav.trainingSessionId);
  else url.searchParams.delete("training");
  return `${url.pathname}${url.search}${url.hash}`;
}

function writeNavToUrl(nav: NavState, mode: "push" | "replace") {
  const next = buildNavUrl(nav);
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === cur) {
    window.history.replaceState({ ligaNav: true }, "", next);
    return false;
  }
  if (mode === "push") window.history.pushState({ ligaNav: true }, "", next);
  else window.history.replaceState({ ligaNav: true }, "", next);
  return true;
}

export function App() {
  const displayMode = new URLSearchParams(window.location.search).get("display");
  if (displayMode === "live") {
    return <LiveMatchBoard />;
  }
  if (displayMode === "result-preview") {
    return <MatchResultView preview />;
  }
  if (displayMode === "preview" || displayMode === "preview-end") {
    return (
      <LiveMatchDisplay
        preview
        previewPhase={displayMode === "preview-end" ? "final" : "live"}
      />
    );
  }
  return <LeagueApp />;
}

function LeagueApp() {
  const { admin, teamId: loginTeamId, teamName, ready: authReady } = useAuth();
  const {
    state,
    remote,
    archived,
    seasons,
    seasonId,
    loadSeason,
    syncFromRemote,
  } = useStore();
  const [newSeasonOpen, setNewSeasonOpen] = useState(false);
  /** Iz rezultatov: ogled → po potrditvi urejanje. */
  const [resultsEditing, setResultsEditing] = useState(false);
  const canEdit = admin && !archived;
  const loginTeam = state.teams.find((team) => team.id === loginTeamId);
  const teamCaps = teamPerms(loginTeam);
  const shownSeasons = admin ? seasons : seasons.filter((s) => !s.training);
  const training = Boolean(state.training || seasons.find((s) => s.id === seasonId)?.training);
  const initialNav = useRef(readNavFromUrl()).current;
  const [page, setPage] = useState<Page>(initialNav.page);
  const [matchId, setMatchId] = useState<string | null>(initialNav.matchId);
  const [detailTeamId, setDetailTeamId] = useState<string | null>(initialNav.detailTeamId);
  const [trainingSessionId, setTrainingSessionId] = useState<string | null>(
    initialNav.trainingSessionId,
  );
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("invite"),
  );
  /** undefined = še ni bilo prvega auth ticka (osvežitev strani ne sme vreči na razpored). */
  const prevLoginTeam = useRef<string | null | undefined>(undefined);
  const navRef = useRef<NavState>(initialNav);
  navRef.current = { page, matchId, detailTeamId, trainingSessionId };
  /** Koliko naših pushState vnosov — da Nazaj ne zapusti aplikacije. */
  const navDepthRef = useRef(0);
  const syncRef = useRef(syncFromRemote);
  syncRef.current = syncFromRemote;

  /** Ob preklopu zavihka naloži sveže rezultate/lestvico iz baze. */
  useEffect(() => {
    if (!remote || matchId || detailTeamId || trainingSessionId) return;
    if (
      page === "schedule" ||
      page === "results" ||
      page === "standings" ||
      page === "players" ||
      page === "teams"
    ) {
      void syncRef.current();
    }
  }, [remote, page, matchId, detailTeamId, trainingSessionId]);

  const commitNav = (next: NavState, mode: "push" | "replace") => {
    setPage(next.page);
    setMatchId(next.matchId);
    setDetailTeamId(next.detailTeamId);
    setTrainingSessionId(next.trainingSessionId);
    navRef.current = next;
    if (writeNavToUrl(next, mode) && mode === "push") navDepthRef.current += 1;
  };

  const go = (next: Page, mode: "push" | "replace" = "push") => {
    commitNav(
      {
        page: next,
        matchId: null,
        detailTeamId: null,
        trainingSessionId: next === "training" ? navRef.current.trainingSessionId : null,
      },
      mode,
    );
    window.scrollTo(0, 0);
  };

  const openMatch = (id: string) => {
    setResultsEditing(false);
    commitNav({ ...navRef.current, matchId: id, detailTeamId: null }, "push");
  };

  useEffect(() => {
    if (page !== "results" || !matchId) setResultsEditing(false);
  }, [page, matchId]);

  const openTeam = (id: string) => {
    commitNav({ ...navRef.current, page: "teams", detailTeamId: id, matchId: null }, "push");
  };

  const navigateBack = (fallback: () => void) => {
    if (navDepthRef.current > 0) window.history.back();
    else fallback();
  };

  const openTraining = (id: string | null) => {
    if (id) commitNav({ ...navRef.current, trainingSessionId: id }, "push");
    else navigateBack(() => commitNav({ ...navRef.current, trainingSessionId: null }, "replace"));
  };

  useEffect(() => {
    window.history.replaceState({ ligaNav: true }, "", window.location.href);
    const onPop = () => {
      navDepthRef.current = Math.max(0, navDepthRef.current - 1);
      const nav = readNavFromUrl();
      navRef.current = nav;
      setPage(nav.page);
      setMatchId(nav.matchId);
      setDetailTeamId(nav.detailTeamId);
      setTrainingSessionId(nav.trainingSessionId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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

  useEffect(() => {
    if (!authReady) return;
    const cur = navRef.current;
    // Trening zavihek samo za admina.
    if (cur.page === "training" && !canEdit) {
      commitNav({ ...cur, page: "schedule", trainingSessionId: null }, "replace");
      return;
    }
    if (canEdit) return;
    if (cur.page === "access") {
      commitNav({ ...cur, page: "schedule", matchId: null, detailTeamId: null }, "replace");
      return;
    }
    if (cur.page === "teams" && !loginTeamId) {
      commitNav({ ...cur, page: "schedule", detailTeamId: null }, "replace");
      return;
    }
    // Gost brez ekipe ne odpre vpisa — šele ko auth ve, da ni prijave.
    if (!admin && !loginTeamId && cur.page === "schedule" && cur.matchId) {
      commitNav({ ...cur, matchId: null }, "replace");
    }
  }, [authReady, admin, canEdit, loginTeamId, page, matchId]);

  useEffect(() => {
    if (admin || !training) return;
    const id = publicSeasonId(seasons, seasonId);
    if (id && id !== seasonId) void loadSeason(id);
  }, [admin, training, seasons, seasonId, loadSeason]);

  useEffect(() => {
    if (prevLoginTeam.current === undefined) {
      prevLoginTeam.current = loginTeamId;
      return;
    }
    if (!prevLoginTeam.current && loginTeamId) go("schedule", "replace");
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
              onNewSeason={() => setNewSeasonOpen(true)}
              onAccess={() => go("access")}
            />
          )}
          <Login
            onInviteCode={(token) => {
              setInviteToken(token);
            }}
          />
        </div>
      </header>

      <NewSeasonDialog
        open={newSeasonOpen}
        onClose={() => setNewSeasonOpen(false)}
        onCreated={() => go("teams")}
      />

      <div className={page === "players" ? "app-shell is-wide" : "app-shell"}>
        <h1 className="page-title">Bowling liga Lenart.</h1>
        {inviteToken != null && !loginTeamId && !admin ? (
          <ClaimInvite
            token={inviteToken}
            onDone={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("invite");
              const qs = url.searchParams.toString();
              window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
              setInviteToken(null);
            }}
          />
        ) : (
        <>
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
                Prijava: Moja ekipa{teamName ? ` (${teamName})` : ""}. Dovoljenja nastavi admin.
              </span>
            )}
          </div>
        )}
        {legacyTraining ? (
          <Training
            sessionId={trainingSessionId}
            ownerTeamId={null}
            canPickTeam={false}
            onOpen={openTraining}
            onBack={() =>
              navigateBack(() => commitNav({ ...navRef.current, trainingSessionId: null }, "replace"))
            }
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
              ...(canEdit || Boolean(loginTeamId)
                ? [["teams", loginTeamId && !admin ? "Moja ekipa" : "Ekipe"] as [Page, string]]
                : []),
              ...(canEdit ? [["training", "Trening"] as [Page, string]] : []),
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
            onOpen={canEdit || canOpenTeamMatch(loginTeam) ? openMatch : undefined}
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
            <Matches mode="results" onOpen={openMatch} />
            <PdfButton label="Izvozi PDF rezultatov" onExport={() => exportResultsPdf(state)} />
          </>
        )}
        {page === "schedule" && matchId && (
          <MatchEntry
            matchId={matchId}
            onBack={() =>
              navigateBack(() => commitNav({ ...navRef.current, matchId: null }, "replace"))
            }
            readOnly={!canEdit && !loginTeamId}
            lineupTeamId={canEdit ? null : loginTeamId}
          />
        )}
        {page === "results" && matchId && !resultsEditing && (
          <MatchResultPage
            matchId={matchId}
            canEdit={canEdit}
            onBack={() =>
              navigateBack(() => commitNav({ ...navRef.current, matchId: null }, "replace"))
            }
            onEdit={() => {
              if (window.confirm("Res želiš popraviti rezultat te tekme?")) {
                setResultsEditing(true);
              }
            }}
          />
        )}
        {page === "results" && matchId && resultsEditing && (
          <MatchEntry
            matchId={matchId}
            onBack={() => setResultsEditing(false)}
            readOnly={false}
            lineupTeamId={null}
          />
        )}
        {page === "standings" && (
          <div className="board-view">
            <div className="board-view-glow" aria-hidden />
            <Standings />
          </div>
        )}
        {page === "players" && (
          <div className="board-view">
            <div className="board-view-glow" aria-hidden />
            <PlayerStandings />
          </div>
        )}
        {page === "access" && canEdit && <TeamAccess />}
        {page === "training" && canEdit && (
          <AdminTraining
            sessionId={trainingSessionId}
            onOpen={openTraining}
            onBack={() =>
              navigateBack(() =>
                commitNav({ ...navRef.current, trainingSessionId: null }, "replace"),
              )
            }
          />
        )}
        {(canEdit || teamCaps.season) && page === "teams" && !detailTeamId && (
          <Teams onOpen={openTeam} />
        )}
        {(canEdit || teamCaps.season) && page === "teams" && detailTeamId && (
          <TeamDetail
            teamId={detailTeamId}
            onBack={() =>
              navigateBack(() => commitNav({ ...navRef.current, detailTeamId: null }, "replace"))
            }
            canManage={canEdit}
            canRoster={canEdit || canTeam(loginTeam, "roster")}
            showTraining={canEdit || detailTeamId === loginTeamId}
            onOpenMatch={(id) => {
              commitNav(
                { ...navRef.current, page: "results", matchId: id, detailTeamId: null },
                "push",
              );
            }}
          />
        )}
        {Boolean(loginTeamId) && !teamCaps.season && !canEdit && page === "teams" && (
          <TeamDetail
            teamId={loginTeamId!}
            onBack={() => navigateBack(() => go("schedule", "replace"))}
            backLabel="← Razpored"
            canManage={false}
            canRoster={canTeam(loginTeam, "roster")}
            onOpenMatch={(id) => {
              commitNav(
                { ...navRef.current, page: "results", matchId: id, detailTeamId: null },
                "push",
              );
            }}
          />
        )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
