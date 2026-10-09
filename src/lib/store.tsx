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
import { buildSeasonMatches } from "./schedule";
import { archiveLeague, createLeague, fetchLeague, reopenLeague, saveLeague, type LeaguePayload } from "./leagueApi";
import {
  addVaultSeason,
  closeVaultSeason,
  loadVault,
  reopenVaultSeason,
  saveState,
  saveVault,
  vaultInfos,
  writeCurrent,
  type SeasonVault,
} from "./storage";
import { uid } from "./ids";
import { MAX_BENCH, PLAYERS_ON_LANE } from "./scoring";
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
  importState: (next: LeagueState) => void;
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
  }, []);

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
      importState: (next) =>
        update(() => ({
          seasonKey: next.seasonKey,
          seasonTitle: next.seasonTitle,
          teams: next.teams ?? [],
          players: next.players ?? [],
          matches: next.matches ?? [],
        })),
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
          applyRemote(await archiveLeague());
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
