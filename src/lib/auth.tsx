import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Auth = {
  admin: boolean;
  ready: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

async function readJson(res: Response): Promise<{ admin?: boolean; ok?: boolean }> {
  try {
    return (await res.json()) as { admin?: boolean; ok?: boolean };
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin" })
      .then(readJson)
      .then((data) => {
        if (!cancelled) setAdmin(Boolean(data.admin));
      })
      .catch(() => {
        if (!cancelled) setAdmin(false);
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
      ready,
      login: async (password) => {
        const res = await fetch("/api/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const ok = res.ok && Boolean((await readJson(res)).ok);
        setAdmin(ok);
        return ok;
      },
      logout: async () => {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        setAdmin(false);
      },
    }),
    [admin, ready],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Auth missing");
  return ctx;
}
