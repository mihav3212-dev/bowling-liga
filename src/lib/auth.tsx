import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { verifyPassword } from "./passwords";
import { currentVaultOfficialTeams } from "./storage";

const TEAM_KEY = "liga-team-local";

type Auth = {
  admin: boolean;
  teamId: string | null;
  teamName: string | null;
  ready: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

type Me = { admin?: boolean; teamId?: string | null; teamName?: string | null; ok?: boolean };

async function readJson(res: Response): Promise<Me> {
  try {
    return (await res.json()) as Me;
  } catch {
    return {};
  }
}

function readLocalTeam(): { teamId: string; teamName: string } | null {
  try {
    const raw = sessionStorage.getItem(TEAM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { teamId?: string; teamName?: string };
    if (!data.teamId) return null;
    return { teamId: data.teamId, teamName: data.teamName ?? "" };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin" })
      .then(readJson)
      .then((data) => {
        if (cancelled) return;
        if (data.admin) {
          setAdmin(true);
          setTeamId(null);
          setTeamName(null);
          sessionStorage.removeItem(TEAM_KEY);
          return;
        }
        if (data.teamId) {
          setAdmin(false);
          setTeamId(data.teamId);
          setTeamName(data.teamName ?? null);
          sessionStorage.removeItem(TEAM_KEY);
          return;
        }
        const local = readLocalTeam();
        setAdmin(false);
        setTeamId(local?.teamId ?? null);
        setTeamName(local?.teamName ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          const local = readLocalTeam();
          setAdmin(false);
          setTeamId(local?.teamId ?? null);
          setTeamName(local?.teamName ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const api = useMemo<Auth>(
    () => ({
      admin,
      teamId,
      teamName,
      ready,
      login: async (password) => {
        const res = await fetch("/api/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await readJson(res);
        if (res.ok && data.admin) {
          setAdmin(true);
          setTeamId(null);
          setTeamName(null);
          sessionStorage.removeItem(TEAM_KEY);
          return true;
        }
        if (res.ok && data.teamId) {
          setAdmin(false);
          setTeamId(data.teamId);
          setTeamName(data.teamName ?? null);
          sessionStorage.removeItem(TEAM_KEY);
          return true;
        }
        for (const team of currentVaultOfficialTeams()) {
          if (await verifyPassword(password, team.passwordHash)) {
            setAdmin(false);
            setTeamId(team.id);
            setTeamName(team.name);
            sessionStorage.setItem(TEAM_KEY, JSON.stringify({ teamId: team.id, teamName: team.name }));
            return true;
          }
        }
        return false;
      },
      logout: async () => {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        sessionStorage.removeItem(TEAM_KEY);
        setAdmin(false);
        setTeamId(null);
        setTeamName(null);
      },
    }),
    [admin, teamId, teamName, ready],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Auth missing");
  return ctx;
}
