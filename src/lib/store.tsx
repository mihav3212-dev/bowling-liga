import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { nominatedIds } from "./pairings";
import { lineupLocked } from "./scoring";
import { createSeed, createSeed2025 } from "./seed";
import {
  appendFixtureRows,
  appendOfficialRemaining,
  buildDrawMatches,
  buildReturnDraw,
  buildSeasonMatches,
  type FixtureRow,
} from "./schedule";
import {
  archiveLeague,
  createLeague,
  createLeagueFromSource,
  deleteLeague,
  fetchLeague,
  renameLeague,
  replaceLeague,
  reopenLeague,
  saveAdminMatch,
  saveLeague,
  saveMatchGame,
  saveMatchLineup,
  saveTeamRoster,
  saveTeamTrainings,
  setTeamPassword,
  createTeamInvite as createTeamInviteRemote,
  type LeaguePayload,
} from "./leagueApi";
import { hashInviteToken, inviteExpiryIso, inviteLink, newInviteToken } from "./invite";
import {
  addVaultSeason,
  closeVaultSeason,
  deleteVaultSeason,
  loadVault,
  renameVaultSeason,
  replaceVaultSeason,
  reopenVaultSeason,
  saveState,
  saveVault,
  vaultInfos,
  writeCurrent,
  type SeasonVault,
} from "./storage";
import { canEnterPins, canTeam, defaultTeamPerms, teamPerms, teamRosterWindowOpen } from "./access";
import {
  applyLineup,
  playerOnOtherLane,
  repairDuplicateLanePlayers,
  rosterIdsForTeam,
  sanitizeLineup,
  teamMatchSide,
} from "./lineup";
import { useAuth } from "./auth";
import { cloneTeamsAndPlayers } from "./cloneRoster";
import { uid } from "./ids";
import { hashPassword } from "./passwords";
import {
  compactGames,
  compactTrainings,
  emptyTrainingMatch,
  emptyTrainingState,
  getTeamSessions,
  padGames,
  setTeamSessions,
  todayDate,
  trainingAsMatch,
  TRAINING_TEAM_ID,
} from "./training";
import type { Gender, LeagueState, Player, SeasonInfo, Team, TeamPerms } from "./types";

type Store = {
  state: LeagueState;
  remote: boolean;
  archived: boolean;
  seasonId: string | null;
  seasonLabel: string;
  seasons: SeasonInfo[];
  addTeam: (name: string, contact?: { captain?: string; phone?: string; email?: string }) => void;
  renameTeam: (id: string, name: string) => void;
  updateTeam: (id: string, patch: Partial<Omit<Team, "id">>) => void;
  addPlayer: (teamId: string, name: string, gender: Gender, bzsMember: boolean) => void;
  updatePlayer: (player: Player) => void;
  removePlayer: (id: string) => void;
  generateSchedule: () => void;
  drawSchedule: (dates: string[]) => void;
  drawReturnSchedule: (dates: string[]) => void;
  setLineup: (
    matchId: string,
    side: "home" | "away",
    starters: string[],
    bench: string[],
  ) => void;
  /** Spremeni datum/uro tekme (admin / sezona). */
  setMatchStartsAt: (matchId: string, startsAt: string) => void;
  /** Zamenjaj termina dveh tekem. */
  swapMatchStartsAt: (matchIdA: string, matchIdB: string) => void;
  setPins: (
    matchId: string,
    roundIndex: number,
    gameIndex: number,
    side: "home" | "away",
    pins: number | null,
  ) => void;
  setRoundPlayer: (
    matchId: string,
    roundIndex: number,
    gameIndex: number,
    side: "home" | "away",
    playerId: string,
  ) => void;
  /** Osveži tekme/igralce iz baze (za hkratni vpis). Vrne false, če ni oddaljeno. */
  syncFromRemote: () => Promise<boolean>;
  resetDemo: () => void;
  loadSeason2025: () => Promise<void>;
  newEmptySeason: (title: string) => Promise<void>;
  /** Nova sezona z izbranimi ekipami (in igralci) iz druge sezone. */
  newSeasonFromRoster: (
    title: string,
    opts: {
      sourceSeasonId: string;
      teams: Team[];
      players: Player[];
      teamIds: string[];
      includePlayers: boolean;
    },
  ) => Promise<void>;
  openTrainingSeason: () => Promise<void>;
  startNewTraining: () => Promise<string>;
  newTrainingSession: (teamId?: string) => string;
  newTrainingMatch: (
    home: { teamId?: string; name?: string },
    away: { teamId?: string; name?: string },
    /** global = trainingSessions (admin zavihek); team = teamTrainings[home.teamId] */
    scope?: "team" | "global",
  ) => string;
  setTrainingMatchLineup: (
    sessionId: string,
    side: "home" | "away",
    starters: string[],
    bench: string[],
    teamId?: string,
  ) => void;
  setTrainingMatchPins: (
    sessionId: string,
    roundIndex: number,
    gameIndex: number,
    side: "home" | "away",
    pins: number | null,
    teamId?: string,
  ) => void;
  setTrainingMatchPlayer: (
    sessionId: string,
    roundIndex: number,
    gameIndex: number,
    side: "home" | "away",
    playerId: string,
    teamId?: string,
  ) => void;
  setTrainingDate: (sessionId: string, date: string, teamId?: string) => void;
  addTrainingPlayer: (
    sessionId: string,
    name: string,
    gender: Gender,
    bzsMember: boolean,
    teamId?: string,
    playerTeamId?: string,
  ) => void;
  pickTrainingPlayer: (sessionId: string, playerId: string, teamId?: string) => void;
  setTrainingPins: (
    sessionId: string,
    playerId: string,
    gameIndex: number,
    pins: number | null,
    teamId?: string,
  ) => void;
  removeTrainingScore: (sessionId: string, playerId: string, teamId?: string) => void;
  deleteTrainingSession: (sessionId: string, teamId?: string) => void;
  saveTrainingNow: () => Promise<boolean>;
  saveMatchLineupNow: (matchId: string) => Promise<boolean>;
  /** Admin: zapiše to tekmo (oznake A/B + keglje), ne cele sezone. */
  saveShownMatch: (matchId: string) => Promise<boolean>;
  saveTeamRosterNow: (teamId: string) => Promise<boolean>;
  setTeamAccess: (teamId: string, password: string) => Promise<void>;
  createTeamInvite: (teamId: string) => Promise<{ url: string; token: string; expiresAt: string }>;
  setTeamPerms: (teamId: string, perms: Partial<TeamPerms>) => void;
  importState: (next: LeagueState) => void;
  importSeason: (next: LeagueState) => Promise<void>;
  replaceSeason: (id: string, next: LeagueState, label?: string) => Promise<void>;
  renameSeason: (id: string, label: string) => Promise<void>;
  deleteSeason: (id: string) => Promise<void>;
  importFixtures: (rows: FixtureRow[]) => void;
  appendOfficialSchedule: () => void;
  loadSeason: (id: string) => Promise<void>;
  closeSeason: () => Promise<void>;
  reopenSeason: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { admin, ready, teamId: viewerTeamId } = useAuth();
  const viewerTeamRef = useRef<string | null>(viewerTeamId);
  viewerTeamRef.current = viewerTeamId;
  const vaultRef = useRef<SeasonVault | null>(null);
  if (!vaultRef.current) vaultRef.current = loadVault(createSeed());
  const opening = vaultRef.current.seasons.find((s) => s.id === vaultRef.current!.currentId)
    ?? vaultRef.current.seasons[0];

  const [state, setState] = useState<LeagueState>(opening.data);
  const [remote, setRemote] = useState(false);
  const [archived, setArchived] = useState(opening.archived);
  const [seasonId, setSeasonId] = useState<string | null>(opening.id);
  const [label, setLabel] = useState(opening.label);
  const [seasons, setSeasons] = useState<SeasonInfo[]>(() => vaultInfos(vaultRef.current!));
  const stateRef = useRef(opening.data);
  const remoteRef = useRef(false);
  const archivedRef = useRef(opening.archived);
  const seasonIdRef = useRef<string | null>(opening.id);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editEpoch = useRef(0);
  const savesInFlight = useRef(0);

  const noteEdit = () => {
    editEpoch.current += 1;
  };

  const trackSave = async (work: () => Promise<unknown>) => {
    savesInFlight.current += 1;
    try {
      return await work();
    } finally {
      savesInFlight.current -= 1;
    }
  };

  const applyVault = (nextVault: SeasonVault, id: string) => {
    const season = nextVault.seasons.find((s) => s.id === id) ?? nextVault.seasons[0];
    const stored: SeasonVault = { ...nextVault, currentId: season.id };
    vaultRef.current = stored;
    saveVault(stored);
    archivedRef.current = season.archived;
    seasonIdRef.current = season.id;
    setArchived(season.archived);
    setSeasonId(season.id);
    setLabel(season.label);
    setSeasons(vaultInfos(stored));
    setState(season.data);
    stateRef.current = season.data;
  };

  const persist = (next: LeagueState): LeagueState => {
    const packed = compactTrainings(next);
    if (remoteRef.current && !archivedRef.current && seasonIdRef.current) {
      const id = seasonIdRef.current;
      const team = viewerTeamRef.current;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = undefined;
        if (seasonIdRef.current !== id) return;
        const latest = stateRef.current;
        void trackSave(async () => {
          if (team) {
            const perms = teamPerms(latest.teams.find((item) => item.id === team));
            if (perms.season) await saveLeague(id, latest);
            else await saveTeamTrainings(id, team, latest.teamTrainings?.[team] ?? []);
          } else {
            await saveLeague(id, latest);
          }
        });
      }, 600);
    } else if (!remoteRef.current && vaultRef.current && !archivedRef.current) {
      vaultRef.current = writeCurrent(vaultRef.current, packed);
      setSeasons(vaultInfos(vaultRef.current));
    }
    stateRef.current = packed;
    return packed;
  };

  const update = (recipe: (s: LeagueState) => LeagueState) => {
    noteEdit();
    setState((s) => {
      if (archivedRef.current) return s;
      return persist(recipe(s));
    });
  };

  /** Lokalni popravek brez celotnega saveLeague — za keglje/igralce na tekmi. */
  const touchLocal = (recipe: (s: LeagueState) => LeagueState) => {
    noteEdit();
    setState((s) => {
      if (archivedRef.current) return s;
      const packed = compactTrainings(recipe(s));
      stateRef.current = packed;
      if (!remoteRef.current && vaultRef.current && !archivedRef.current) {
        vaultRef.current = writeCurrent(vaultRef.current, packed);
        setSeasons(vaultInfos(vaultRef.current));
      } else {
        saveState(packed);
      }
      return packed;
    });
  };

  const viewerMayRoster = () => {
    const viewer = viewerTeamRef.current;
    if (!viewer) return true;
    return (
      canTeam(stateRef.current.teams.find((t) => t.id === viewer), "roster") &&
      teamRosterWindowOpen(stateRef.current.matches)
    );
  };

  const flushRoster = (s: LeagueState) => {
    const team = viewerTeamRef.current;
    if (!remoteRef.current || !team || !seasonIdRef.current) return;
    if (teamPerms(s.teams.find((item) => item.id === team)).season) return;
    void saveTeamRoster(
      seasonIdRef.current,
      team,
      s.players.filter((player) => player.teamId === team),
    );
  };

  const applyRemote = (payload: LeaguePayload) => {
    if (payload.storage !== "db" || !payload.current) {
      remoteRef.current = false;
      setRemote(false);
      return;
    }
    remoteRef.current = true;
    archivedRef.current = payload.current.archived;
    seasonIdRef.current = payload.current.id;
    setRemote(true);
    setArchived(payload.current.archived);
    setSeasonId(payload.current.id);
    setLabel(payload.current.label);
    setSeasons(payload.seasons ?? []);
    setState(payload.current.data);
    stateRef.current = payload.current.data;
    saveState(payload.current.data);
  };

  const openSeason = async (label: string, data: LeagueState) => {
    if (remoteRef.current) {
      applyRemote(await createLeague(label, data));
      return;
    }
    const next = addVaultSeason(vaultRef.current ?? loadVault(data), label, data);
    applyVault(next, next.currentId);
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchLeague()
      .then((payload) => {
        if (!cancelled) applyRemote(payload);
      })
      .catch(() => {
        if (!cancelled) {
          remoteRef.current = false;
          setRemote(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, admin, viewerTeamId]);

  const api = useMemo<Store>(
    () => ({
      state,
      remote,
      archived,
      seasonId,
      seasonLabel: label,
      seasons,
      addTeam: (name, contact) => {
        if (viewerTeamRef.current && !canTeam(stateRef.current.teams.find((t) => t.id === viewerTeamRef.current), "season")) {
          return;
        }
        update((s) => ({
          ...s,
          teams: [
            ...s.teams,
            {
              id: uid("t"),
              name: name.trim(),
              captain: contact?.captain?.trim() || undefined,
              phone: contact?.phone?.trim() || undefined,
              email: contact?.email?.trim() || undefined,
            },
          ],
        }));
      },
      renameTeam: (id, name) =>
        update((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)) })),
      updateTeam: (id, patch) =>
        update((s) => ({
          ...s,
          teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      addPlayer: (teamId, name, gender, bzsMember) => {
        const viewer = viewerTeamRef.current;
        if (viewer && (viewer !== teamId || !viewerMayRoster())) {
          return;
        }
        update((s) => {
          const next = {
            ...s,
            players: [
              ...s.players,
              {
                id: uid("p"),
                teamId,
                name: name.trim().toLocaleUpperCase("sl"),
                gender,
                bzsMember,
              },
            ],
          };
          flushRoster(next);
          return next;
        });
      },
      updatePlayer: (player) => {
        const viewer = viewerTeamRef.current;
        if (viewer && (player.teamId !== viewer || !viewerMayRoster())) {
          return;
        }
        const normalized = {
          ...player,
          name: player.name.toLocaleUpperCase("sl"),
        };
        update((s) => {
          const next = {
            ...s,
            players: s.players.map((p) => (p.id === normalized.id ? normalized : p)),
          };
          flushRoster(next);
          return next;
        });
      },
      removePlayer: (id) => {
        const viewer = viewerTeamRef.current;
        const player = stateRef.current.players.find((p) => p.id === id);
        if (viewer && (player?.teamId !== viewer || !viewerMayRoster())) {
          return;
        }
        update((s) => {
          const next = { ...s, players: s.players.filter((p) => p.id !== id) };
          flushRoster(next);
          return next;
        });
      },
      generateSchedule: () =>
        update((s) => {
          if (s.matches.length > 0) return s;
          return { ...s, matches: buildSeasonMatches(s.teams) };
        }),
      drawSchedule: (dates) =>
        update((s) => {
          if (s.matches.length > 0) return s;
          const drawn = buildDrawMatches(s.teams, dates);
          return {
            ...s,
            matches: drawn.matches,
            roundLabels: drawn.roundLabels,
            roundNotes: drawn.roundNotes,
          };
        }),
      drawReturnSchedule: (dates) =>
        update((s) => {
          const drawn = buildReturnDraw(s, dates);
          return {
            ...s,
            matches: drawn.matches,
            roundLabels: drawn.roundLabels,
            roundNotes: drawn.roundNotes,
          };
        }),
      setLineup: (matchId, side, starters, bench) => {
        const team = viewerTeamRef.current;
        if (team && !canTeam(stateRef.current.teams.find((t) => t.id === team), "lineup")) return;
        const match = stateRef.current.matches.find((item) => item.id === matchId);
        if (!match || lineupLocked(match.rounds)) return;
        let nextStarters = starters;
        let nextBench = bench;
        if (team) {
          if (teamMatchSide(match, team) !== side) return;
          const clean = sanitizeLineup(starters, bench, rosterIdsForTeam(stateRef.current.players, team));
          nextStarters = clean.starters;
          nextBench = clean.bench;
        }
        // Sestava gre v bazo sama, ne kot cela sezona. Čakajoči zapis celotne
        // sezone ob sprožitvi prebere trenutno stanje, zato sestave ne povozi.
        touchLocal((s) => ({
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== matchId || lineupLocked(m.rounds)) return m;
            if (team && teamMatchSide(m, team) !== side) return m;
            return applyLineup(m, side, nextStarters, nextBench);
          }),
        }));
        if (remoteRef.current && seasonIdRef.current) {
          const season = seasonIdRef.current;
          void trackSave(() => saveMatchLineup(season, matchId, side, nextStarters, nextBench));
        }
      },
      setMatchStartsAt: (matchId, startsAt) => {
        const viewer = viewerTeamRef.current;
        if (viewer) {
          if (!canTeam(stateRef.current.teams.find((t) => t.id === viewer), "season")) return;
        }
        update((s) => ({
          ...s,
          matches: s.matches.map((m) => (m.id === matchId ? { ...m, startsAt } : m)),
        }));
      },
      swapMatchStartsAt: (matchIdA, matchIdB) => {
        if (matchIdA === matchIdB) return;
        const viewer = viewerTeamRef.current;
        if (viewer) {
          if (!canTeam(stateRef.current.teams.find((t) => t.id === viewer), "season")) return;
        }
        update((s) => {
          const a = s.matches.find((m) => m.id === matchIdA);
          const b = s.matches.find((m) => m.id === matchIdB);
          if (!a || !b) return s;
          const startsA = a.startsAt;
          const startsB = b.startsAt;
          return {
            ...s,
            matches: s.matches.map((m) => {
              if (m.id === matchIdA) return { ...m, startsAt: startsB };
              if (m.id === matchIdB) return { ...m, startsAt: startsA };
              return m;
            }),
          };
        });
      },
      setPins: (matchId, roundIndex, gameIndex, side, pins) => {
        const team = viewerTeamRef.current;
        if (team) {
          const match = stateRef.current.matches.find((m) => m.id === matchId);
          if (!match || teamMatchSide(match, team) == null) return;
          const existing =
            match.rounds[roundIndex]?.games[gameIndex]?.[side === "home" ? "homePins" : "awayPins"] ?? null;
          if (!canEnterPins(stateRef.current.teams.find((t) => t.id === team), existing)) return;
        }
        // Ne shranjuj cele sezone — sicer starejši zavihek prepiše sveže keglje.
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        touchLocal((s) => ({
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const rounds = m.rounds.map((round, ri) => {
              if (ri !== roundIndex) return round;
              return {
                games: round.games.map((g, gi) => {
                  if (gi !== gameIndex) return g;
                  return side === "home" ? { ...g, homePins: pins } : { ...g, awayPins: pins };
                }),
              };
            });
            const filled = rounds.every((r) =>
              r.games.every((g) => g.homePins != null && g.awayPins != null),
            );
            return { ...m, rounds, status: filled ? "done" : "scheduled" };
          }),
        }));
        if (remoteRef.current && seasonIdRef.current) {
          // Ne apply-aj odziva tukaj — hitro tipkanje bi sicer lahko prepisalo novejšo lokalno vrednost.
          const season = seasonIdRef.current;
          void trackSave(() => saveMatchGame(season, { matchId, roundIndex, gameIndex, side, pins }));
        }
      },
      setRoundPlayer: (matchId, roundIndex, gameIndex, side, playerId) => {
        const team = viewerTeamRef.current;
        if (team) {
          if (!canTeam(stateRef.current.teams.find((t) => t.id === team), "lineup")) return;
          const match = stateRef.current.matches.find((m) => m.id === matchId);
          if (!match || teamMatchSide(match, team) !== side) return;
        }
        const current = stateRef.current.matches.find((m) => m.id === matchId);
        const games = current?.rounds[roundIndex]?.games ?? [];
        if (playerOnOtherLane(games, side, playerId, gameIndex)) return;
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        touchLocal((s) => ({
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const allowed = nominatedIds(
              side === "home" ? m.homeStarters : m.awayStarters,
              side === "home" ? m.homeBench : m.awayBench,
            );
            if (playerId && !allowed.includes(playerId)) return m;
            if (playerOnOtherLane(m.rounds[roundIndex]?.games ?? [], side, playerId, gameIndex)) return m;
            if (roundIndex === 0 && lineupLocked(m.rounds)) return m;
            return {
              ...m,
              rounds: m.rounds.map((round, ri) => {
                if (ri !== roundIndex) return round;
                return {
                  games: round.games.map((g, gi) => {
                    if (gi !== gameIndex) return g;
                    return side === "home"
                      ? { ...g, homePlayerId: playerId }
                      : { ...g, awayPlayerId: playerId };
                  }),
                };
              }),
            };
          }),
        }));
        if (remoteRef.current && seasonIdRef.current) {
          const season = seasonIdRef.current;
          void trackSave(() =>
            saveMatchGame(season, {
              matchId,
              roundIndex,
              gameIndex,
              side,
              playerId,
            }),
          );
        }
      },
      syncFromRemote: async () => {
        if (!remoteRef.current || !seasonIdRef.current || archivedRef.current) return false;
        if (saveTimer.current || savesInFlight.current > 0) return false;
        const started = editEpoch.current;
        try {
          const payload = await fetchLeague(seasonIdRef.current);
          // Vnos med čakanjem ali shranjevanje iz druge naprave ne sme povoziti lokalnega.
          if (started !== editEpoch.current || saveTimer.current || savesInFlight.current > 0) return false;
          if (payload.storage === "db" && payload.current) {
            applyRemote(payload);
            return true;
          }
        } catch {
          return false;
        }
        return false;
      },
      resetDemo: () => update(() => createSeed()),
      loadSeason2025: async () => {
        const data = createSeed2025();
        await openSeason(data.seasonTitle ?? "2025/2026", data);
      },
      newEmptySeason: async (title) => {
        await openSeason(title, {
          seasonTitle: title,
          teams: [],
          players: [],
          matches: [],
        });
      },
      newSeasonFromRoster: async (title, opts) => {
        if (remoteRef.current) {
          applyRemote(
            await createLeagueFromSource(
              title,
              opts.sourceSeasonId,
              opts.teamIds,
              opts.includePlayers,
            ),
          );
          return;
        }
        const cloned = cloneTeamsAndPlayers(
          opts.teams,
          opts.players,
          opts.teamIds,
          opts.includePlayers,
        );
        await openSeason(title, {
          seasonTitle: title,
          teams: cloned.teams,
          players: cloned.players,
          matches: [],
        });
      },
      openTrainingSeason: async () => {
        const existing = seasons.find((s) => s.training);
        if (existing) {
          if (remoteRef.current) {
            applyRemote(await fetchLeague(existing.id));
            return;
          }
          if (vaultRef.current) applyVault(vaultRef.current, existing.id);
          return;
        }
        await openSeason("Trening", emptyTrainingState());
      },
      startNewTraining: async () => {
        const id = uid("tr");
        const session = { id, date: todayDate(), scores: [] };
        const merge = (data: LeagueState): LeagueState => ({
          ...emptyTrainingState(),
          ...data,
          training: true,
          teams: data.teams?.length ? data.teams : emptyTrainingState().teams,
          players: data.players ?? [],
          matches: data.matches ?? [],
          trainingSessions: [session, ...(data.trainingSessions ?? [])],
        });
        const existing = seasons.find((s) => s.training);
        if (remoteRef.current) {
          if (existing) {
            const payload = await fetchLeague(existing.id);
            const data = merge(payload.current?.data ?? emptyTrainingState());
            applyRemote(await replaceLeague(existing.id, data, existing.label));
          } else {
            applyRemote(await createLeague("Trening", merge(emptyTrainingState())));
          }
          return id;
        }
        if (existing && vaultRef.current) {
          const season = vaultRef.current.seasons.find((s) => s.id === existing.id);
          const data = merge(season?.data ?? emptyTrainingState());
          applyVault(replaceVaultSeason(vaultRef.current, existing.id, existing.label, data), existing.id);
          return id;
        }
        await openSeason("Trening", merge(emptyTrainingState()));
        return id;
      },
      newTrainingSession: (teamId) => {
        const id = uid("tr");
        update((s) =>
          setTeamSessions(s, teamId, [
            { id, date: todayDate(), kind: "solo", scores: [] },
            ...getTeamSessions(s, teamId),
          ]),
        );
        return id;
      },
      newTrainingMatch: (home, away, scope = "team") => {
        const id = uid("tr");
        update((s) => {
          const homeId = home.teamId || uid("tp");
          const awayId = away.teamId || uid("tp");
          const homeName = home.teamId
            ? s.teams.find((t) => t.id === home.teamId)?.name
            : home.name?.trim() || "Skupina A";
          const awayName = away.teamId
            ? s.teams.find((t) => t.id === away.teamId)?.name
            : away.name?.trim() || "Skupina B";
          const session = {
            id,
            date: todayDate(),
            kind: "match" as const,
            scores: [],
            match: emptyTrainingMatch(homeId, awayId, homeName, awayName),
          };
          if (scope === "global") {
            return {
              ...s,
              trainingSessions: [session, ...(s.trainingSessions ?? [])],
            };
          }
          return setTeamSessions(s, home.teamId, [
            session,
            ...getTeamSessions(s, home.teamId),
          ]);
        });
        return id;
      },
      setTrainingMatchLineup: (sessionId, side, starters, bench, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) => {
              if (session.id !== sessionId || !session.match) return session;
              if (lineupLocked(session.match.rounds)) return session;
              const next = applyLineup(trainingAsMatch(session.id, session.match), side, starters, bench);
              return {
                ...session,
                match: {
                  ...session.match,
                  homeStarters: next.homeStarters,
                  awayStarters: next.awayStarters,
                  homeBench: next.homeBench,
                  awayBench: next.awayBench,
                  rounds: next.rounds,
                },
              };
            }),
          ),
        ),
      setTrainingMatchPins: (sessionId, roundIndex, gameIndex, side, pins, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) => {
              if (session.id !== sessionId || !session.match) return session;
              return {
                ...session,
                match: {
                  ...session.match,
                  rounds: session.match.rounds.map((round, ri) => {
                    if (ri !== roundIndex) return round;
                    return {
                      games: round.games.map((g, gi) => {
                        if (gi !== gameIndex) return g;
                        return side === "home" ? { ...g, homePins: pins } : { ...g, awayPins: pins };
                      }),
                    };
                  }),
                },
              };
            }),
          ),
        ),
      setTrainingMatchPlayer: (sessionId, roundIndex, gameIndex, side, playerId, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) => {
              if (session.id !== sessionId || !session.match) return session;
              const match = session.match;
              const allowed = nominatedIds(
                side === "home" ? match.homeStarters : match.awayStarters,
                side === "home" ? match.homeBench : match.awayBench,
              );
              if (playerId && !allowed.includes(playerId)) return session;
              if (roundIndex === 0 && lineupLocked(match.rounds)) return session;
              return {
                ...session,
                match: {
                  ...match,
                  rounds: match.rounds.map((round, ri) => {
                    if (ri !== roundIndex) return round;
                    return {
                      games: round.games.map((g, gi) => {
                        if (gi !== gameIndex) return g;
                        return side === "home"
                          ? { ...g, homePlayerId: playerId }
                          : { ...g, awayPlayerId: playerId };
                      }),
                    };
                  }),
                },
              };
            }),
          ),
        ),
      setTrainingDate: (sessionId, date, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) => (session.id === sessionId ? { ...session, date } : session)),
          ),
        ),
      addTrainingPlayer: (sessionId, name, gender, bzsMember, teamId, playerTeamId) =>
        update((s) => {
          const trimmed = name.trim();
          if (!trimmed) return s;
          const sessions = getTeamSessions(s, teamId);
          const session = sessions.find((item) => item.id === sessionId);
          if (!session) return s;
          // Pri trening tekmi: samo prava ekipa sezone ali gost — nikoli ID skupine A/B.
          const rosterId =
            session.kind === "match"
              ? playerTeamId === TRAINING_TEAM_ID || s.teams.some((t) => t.id === playerTeamId)
                ? playerTeamId
                : undefined
              : playerTeamId || teamId;
          if (session.kind === "match" && !rosterId) return s;
          const existing = s.players.find(
            (p) => p.name.toLowerCase() === trimmed.toLowerCase() && (!rosterId || p.teamId === rosterId),
          );
          const player = existing ?? {
            id: uid("p"),
            teamId: rosterId || s.teams[0]?.id || TRAINING_TEAM_ID,
            name: trimmed,
            gender,
            bzsMember,
          };
          if (session.kind === "match") {
            if (existing) return s;
            return { ...s, players: [...s.players, player] };
          }
          if (session.scores.some((row) => row.playerId === player.id)) return s;
          return setTeamSessions(
            {
              ...s,
              players: existing ? s.players : [...s.players, player],
            },
            teamId,
            sessions.map((item) =>
              item.id === sessionId
                ? { ...item, scores: [...item.scores, { playerId: player.id, games: [] }] }
                : item,
            ),
          );
        }),
      pickTrainingPlayer: (sessionId, playerId, teamId) =>
        update((s) => {
          const sessions = getTeamSessions(s, teamId);
          const session = sessions.find((item) => item.id === sessionId);
          if (!session || !playerId || session.scores.some((row) => row.playerId === playerId)) return s;
          if (!s.players.some((p) => p.id === playerId)) return s;
          return setTeamSessions(
            s,
            teamId,
            sessions.map((item) =>
              item.id === sessionId
                ? { ...item, scores: [...item.scores, { playerId, games: [] }] }
                : item,
            ),
          );
        }),
      setTrainingPins: (sessionId, playerId, gameIndex, pins, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) => {
              if (session.id !== sessionId) return session;
              return {
                ...session,
                scores: session.scores.map((row) => {
                  if (row.playerId !== playerId) return row;
                  const games = padGames(row.games, gameIndex + 1);
                  games[gameIndex] = pins;
                  return { ...row, games: compactGames(games) };
                }),
              };
            }),
          ),
        ),
      removeTrainingScore: (sessionId, playerId, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).map((session) =>
              session.id === sessionId
                ? { ...session, scores: session.scores.filter((row) => row.playerId !== playerId) }
                : session,
            ),
          ),
        ),
      deleteTrainingSession: (sessionId, teamId) =>
        update((s) =>
          setTeamSessions(
            s,
            teamId,
            getTeamSessions(s, teamId).filter((session) => session.id !== sessionId),
          ),
        ),
      saveMatchLineupNow: async (matchId) => {
        const packed = compactTrainings(stateRef.current);
        const team = viewerTeamRef.current;
        const match = packed.matches.find((item) => item.id === matchId);
        if (!remoteRef.current || !seasonIdRef.current) {
          update(() => packed);
          return true;
        }
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        if (!match) return false;
        const own = team ? teamMatchSide(match, team) : null;
        if (team && !own) return false;
        const sides: ("home" | "away")[] = own ? [own] : ["home", "away"];
        try {
          let ok = true;
          for (const side of sides) {
            const starters = side === "home" ? match.homeStarters : match.awayStarters;
            const bench = side === "home" ? match.homeBench : match.awayBench;
            const saved = await trackSave(() =>
              saveMatchLineup(seasonIdRef.current as string, matchId, side, starters, bench),
            );
            ok = ok && Boolean(saved);
          }
          return ok;
        } catch {
          return false;
        }
      },
      saveShownMatch: async (matchId) => {
        const packed = compactTrainings(stateRef.current);
        const match = packed.matches.find((item) => item.id === matchId);
        if (!match) return false;
        const fixed = repairDuplicateLanePlayers(match);
        if (!remoteRef.current || !seasonIdRef.current) {
          update((s) => ({
            ...s,
            matches: s.matches.map((item) => (item.id === matchId ? fixed : item)),
          }));
          return true;
        }
        if (viewerTeamRef.current) return false;
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        touchLocal((s) => ({
          ...s,
          matches: s.matches.map((item) => (item.id === matchId ? fixed : item)),
        }));
        try {
          return Boolean(await trackSave(() => saveAdminMatch(seasonIdRef.current as string, fixed)));
        } catch {
          return false;
        }
      },
      saveTeamRosterNow: async (teamId) => {
        const packed = compactTrainings(stateRef.current);
        clearTimeout(saveTimer.current);
        update(() => packed);
        if (archivedRef.current) return false;
        if (!remoteRef.current || !seasonIdRef.current) return true;
        try {
          const team = viewerTeamRef.current;
          if (team) {
            if (team !== teamId) return false;
            const perms = teamPerms(packed.teams.find((item) => item.id === team));
            if (perms.season) {
              return await saveLeague(seasonIdRef.current, packed);
            }
            return await saveTeamRoster(
              seasonIdRef.current,
              team,
              packed.players.filter((player) => player.teamId === team),
            );
          }
          return await saveLeague(seasonIdRef.current, packed);
        } catch {
          return false;
        }
      },
      saveTrainingNow: async () => {
        const packed = compactTrainings(state);
        update(() => packed);
        if (remoteRef.current && seasonIdRef.current) {
          try {
            const team = viewerTeamRef.current;
            if (team) {
              return await saveTeamTrainings(seasonIdRef.current, team, packed.teamTrainings?.[team] ?? []);
            }
            return await saveLeague(seasonIdRef.current, packed);
          } catch {
            return false;
          }
        }
        return true;
      },
      setTeamPerms: (teamId, perms) => {
        if (viewerTeamRef.current) return;
        update((s) => ({
          ...s,
          teams: s.teams.map((team) =>
            team.id === teamId ? { ...team, perms: defaultTeamPerms({ ...teamPerms(team), ...perms }) } : team,
          ),
        }));
      },
      setTeamAccess: async (id, password) => {
        const season = seasonIdRef.current;
        if (remoteRef.current && season) {
          applyRemote(await setTeamPassword(season, id, password));
          return;
        }
        const trimmed = password.trim();
        const hash = trimmed ? await hashPassword(trimmed) : undefined;
        update((s) => ({
          ...s,
          teams: s.teams.map((team) =>
            team.id === id
              ? {
                  ...team,
                  passwordHash: hash,
                  hasAccess: Boolean(hash),
                  inviteHash: undefined,
                  inviteExpires: undefined,
                  hasInvite: false,
                }
              : team,
          ),
        }));
      },
      createTeamInvite: async (id) => {
        const season = seasonIdRef.current;
        if (remoteRef.current && season) {
          const payload = await createTeamInviteRemote(season, id);
          applyRemote(payload);
          return { url: inviteLink(payload.token), token: payload.token, expiresAt: payload.expiresAt };
        }
        const token = newInviteToken();
        const expiresAt = inviteExpiryIso();
        const inviteHash = await hashInviteToken(token);
        update((s) => ({
          ...s,
          teams: s.teams.map((team) =>
            team.id === id ? { ...team, inviteHash, inviteExpires: expiresAt, hasInvite: true } : team,
          ),
        }));
        return { url: inviteLink(token), token, expiresAt };
      },
      importState: (next) =>
        update(() => ({
          seasonKey: next.seasonKey,
          seasonTitle: next.seasonTitle,
          teams: next.teams ?? [],
          players: next.players ?? [],
          matches: next.matches ?? [],
          roundNotes: next.roundNotes,
          roundLabels: next.roundLabels,
          trainingSessions: next.trainingSessions,
          teamTrainings: next.teamTrainings,
        })),
      importSeason: async (next) => {
        const title = next.seasonTitle?.trim() || "Uvožena sezona";
        await openSeason(title, {
          seasonKey: next.seasonKey,
          seasonTitle: title,
          training: next.training,
          teams: next.teams ?? [],
          players: next.players ?? [],
          matches: next.matches ?? [],
          roundNotes: next.roundNotes,
          roundLabels: next.roundLabels,
          trainingSessions: next.trainingSessions,
          teamTrainings: next.teamTrainings,
        });
      },
      replaceSeason: async (id, next, label) => {
        const existing = seasons.find((s) => s.id === id);
        const title = (label || next.seasonTitle || existing?.label || "Uvožena sezona").trim();
        const data: LeagueState = {
          seasonKey: next.seasonKey,
          seasonTitle: title,
          training: Boolean(existing?.training),
          teams: next.teams ?? [],
          players: next.players ?? [],
          matches: next.matches ?? [],
          roundNotes: next.roundNotes,
          roundLabels: next.roundLabels,
          trainingSessions: next.trainingSessions,
          teamTrainings: next.teamTrainings,
        };
        if (remoteRef.current) {
          applyRemote(await replaceLeague(id, data, title));
          return;
        }
        if (vaultRef.current) applyVault(replaceVaultSeason(vaultRef.current, id, title, data), id);
      },
      renameSeason: async (id, label) => {
        const name = label.trim();
        if (!name) return;
        if (remoteRef.current) {
          applyRemote(await renameLeague(id, name));
          return;
        }
        if (vaultRef.current) applyVault(renameVaultSeason(vaultRef.current, id, name), vaultRef.current.currentId);
      },
      deleteSeason: async (id) => {
        if (remoteRef.current) {
          applyRemote(await deleteLeague(id));
          return;
        }
        if (!vaultRef.current) return;
        const next = deleteVaultSeason(vaultRef.current, id);
        applyVault(next, next.currentId);
      },
      importFixtures: (rows) => update((s) => appendFixtureRows(s, rows)),
      appendOfficialSchedule: () => update((s) => appendOfficialRemaining(s)),
      loadSeason: async (id) => {
        if (remoteRef.current) {
          const payload = await fetchLeague(id);
          applyRemote(payload);
          return;
        }
        if (vaultRef.current) applyVault(vaultRef.current, id);
      },
      closeSeason: async () => {
        if (remoteRef.current) {
          applyRemote(await archiveLeague(seasonIdRef.current ?? undefined));
          return;
        }
        if (!vaultRef.current) return;
        applyVault(closeVaultSeason(vaultRef.current), vaultRef.current.currentId);
      },
      reopenSeason: async () => {
        const id = seasonIdRef.current;
        if (remoteRef.current) {
          applyRemote(await reopenLeague(id ?? undefined));
          return;
        }
        if (!vaultRef.current || !id) return;
        applyVault(reopenVaultSeason(vaultRef.current, id), id);
      },
    }),
    [state, remote, archived, seasonId, label, seasons],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
