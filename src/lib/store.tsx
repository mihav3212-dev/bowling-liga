import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emptyRounds, nominatedIds } from "./pairings";
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
  deleteLeague,
  fetchLeague,
  renameLeague,
  replaceLeague,
  reopenLeague,
  saveLeague,
  type LeaguePayload,
} from "./leagueApi";
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
import { useAuth } from "./auth";
import { uid } from "./ids";
import { MAX_BENCH, PLAYERS_ON_LANE } from "./scoring";
import { emptyTrainingState, padGames, todayDate, TRAINING_TEAM_ID } from "./training";
import type { Gender, LeagueState, Match, Player, SeasonInfo, Team } from "./types";

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
  resetDemo: () => void;
  loadSeason2025: () => Promise<void>;
  newEmptySeason: (title: string) => Promise<void>;
  openTrainingSeason: () => Promise<void>;
  startNewTraining: () => Promise<string>;
  newTrainingSession: () => string;
  setTrainingDate: (sessionId: string, date: string) => void;
  addTrainingPlayer: (sessionId: string, name: string, gender: Gender, bzsMember: boolean) => void;
  pickTrainingPlayer: (sessionId: string, playerId: string) => void;
  setTrainingPins: (sessionId: string, playerId: string, gameIndex: number, pins: number | null) => void;
  removeTrainingScore: (sessionId: string, playerId: string) => void;
  deleteTrainingSession: (sessionId: string) => void;
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

function applyLineup(match: Match, side: "home" | "away", starters: string[], bench: string[]): Match {
  const cleanStarters = starters.slice(0, PLAYERS_ON_LANE);
  while (cleanStarters.length < PLAYERS_ON_LANE) cleanStarters.push("");
  const cleanBench = bench.filter(Boolean).slice(0, MAX_BENCH);
  const next: Match = {
    ...match,
    ...(side === "home"
      ? { homeStarters: cleanStarters, homeBench: cleanBench }
      : { awayStarters: cleanStarters, awayBench: cleanBench }),
  };
  const home = side === "home" ? cleanStarters : next.homeStarters;
  const away = side === "away" ? cleanStarters : next.awayStarters;
  const template = emptyRounds(home, away);
  next.rounds = template.map((round, ri) => ({
    games: round.games.map((game, gi) => ({
      ...game,
      homePins: match.rounds[ri]?.games[gi]?.homePins ?? null,
      awayPins: match.rounds[ri]?.games[gi]?.awayPins ?? null,
      homePlayerId:
        side === "home"
          ? game.homePlayerId
          : (match.rounds[ri]?.games[gi]?.homePlayerId || game.homePlayerId),
      awayPlayerId:
        side === "away"
          ? game.awayPlayerId
          : (match.rounds[ri]?.games[gi]?.awayPlayerId || game.awayPlayerId),
    })),
  }));
  return next;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { admin, ready } = useAuth();
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
  const remoteRef = useRef(false);
  const archivedRef = useRef(opening.archived);
  const seasonIdRef = useRef<string | null>(opening.id);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
  };

  const persist = (next: LeagueState): LeagueState => {
    if (remoteRef.current && !archivedRef.current && seasonIdRef.current) {
      const id = seasonIdRef.current;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveLeague(id, next);
      }, 600);
    } else if (!remoteRef.current && vaultRef.current && !archivedRef.current) {
      vaultRef.current = writeCurrent(vaultRef.current, next);
      setSeasons(vaultInfos(vaultRef.current));
    }
    return next;
  };

  const update = (recipe: (s: LeagueState) => LeagueState) => {
    setState((s) => {
      if (archivedRef.current) return s;
      return persist(recipe(s));
    });
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
  }, [ready, admin]);

  const api = useMemo<Store>(
    () => ({
      state,
      remote,
      archived,
      seasonId,
      seasonLabel: label,
      seasons,
      addTeam: (name, contact) =>
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
        })),
      renameTeam: (id, name) =>
        update((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)) })),
      updateTeam: (id, patch) =>
        update((s) => ({
          ...s,
          teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      addPlayer: (teamId, name, gender, bzsMember) =>
        update((s) => ({
          ...s,
          players: [...s.players, { id: uid("p"), teamId, name: name.trim(), gender, bzsMember }],
        })),
      updatePlayer: (player) =>
        update((s) => ({ ...s, players: s.players.map((p) => (p.id === player.id ? player : p)) })),
      removePlayer: (id) => update((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) })),
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
      setLineup: (matchId, side, starters, bench) =>
        update((s) => ({
          ...s,
          matches: s.matches.map((m) => (m.id === matchId ? applyLineup(m, side, starters, bench) : m)),
        })),
      setPins: (matchId, roundIndex, gameIndex, side, pins) =>
        update((s) => ({
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
        })),
      setRoundPlayer: (matchId, roundIndex, gameIndex, side, playerId) =>
        update((s) => ({
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const allowed = nominatedIds(
              side === "home" ? m.homeStarters : m.awayStarters,
              side === "home" ? m.homeBench : m.awayBench,
            );
            if (playerId && !allowed.includes(playerId)) return m;
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
        })),
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
      newTrainingSession: () => {
        const id = uid("tr");
        update((s) => ({
          ...s,
          training: true,
          teams: s.teams.length ? s.teams : [{ id: TRAINING_TEAM_ID, name: "Trening" }],
          trainingSessions: [{ id, date: todayDate(), scores: [] }, ...(s.trainingSessions ?? [])],
        }));
        return id;
      },
      setTrainingDate: (sessionId, date) =>
        update((s) => ({
          ...s,
          trainingSessions: (s.trainingSessions ?? []).map((session) =>
            session.id === sessionId ? { ...session, date } : session,
          ),
        })),
      addTrainingPlayer: (sessionId, name, gender, bzsMember) =>
        update((s) => {
          const trimmed = name.trim();
          if (!trimmed) return s;
          const sessions = s.trainingSessions ?? [];
          const session = sessions.find((item) => item.id === sessionId);
          if (!session) return s;
          const existing = s.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
          const player = existing ?? {
            id: uid("p"),
            teamId: s.teams[0]?.id || TRAINING_TEAM_ID,
            name: trimmed,
            gender,
            bzsMember,
          };
          if (session.scores.some((row) => row.playerId === player.id)) return s;
          return {
            ...s,
            players: existing ? s.players : [...s.players, player],
            trainingSessions: sessions.map((item) =>
              item.id === sessionId
                ? { ...item, scores: [...item.scores, { playerId: player.id, games: padGames([]) }] }
                : item,
            ),
          };
        }),
      pickTrainingPlayer: (sessionId, playerId) =>
        update((s) => {
          const sessions = s.trainingSessions ?? [];
          const session = sessions.find((item) => item.id === sessionId);
          if (!session || !playerId || session.scores.some((row) => row.playerId === playerId)) return s;
          if (!s.players.some((p) => p.id === playerId)) return s;
          return {
            ...s,
            trainingSessions: sessions.map((item) =>
              item.id === sessionId
                ? { ...item, scores: [...item.scores, { playerId, games: padGames([]) }] }
                : item,
            ),
          };
        }),
      setTrainingPins: (sessionId, playerId, gameIndex, pins) =>
        update((s) => ({
          ...s,
          trainingSessions: (s.trainingSessions ?? []).map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              scores: session.scores.map((row) => {
                if (row.playerId !== playerId) return row;
                const games = padGames(row.games);
                games[gameIndex] = pins;
                return { ...row, games };
              }),
            };
          }),
        })),
      removeTrainingScore: (sessionId, playerId) =>
        update((s) => ({
          ...s,
          trainingSessions: (s.trainingSessions ?? []).map((session) =>
            session.id === sessionId
              ? { ...session, scores: session.scores.filter((row) => row.playerId !== playerId) }
              : session,
          ),
        })),
      deleteTrainingSession: (sessionId) =>
        update((s) => ({
          ...s,
          trainingSessions: (s.trainingSessions ?? []).filter((session) => session.id !== sessionId),
        })),
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
