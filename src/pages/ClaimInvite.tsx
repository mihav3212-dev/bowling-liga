import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { claimTeamInvite, previewTeamInvite } from "../lib/leagueApi";
import { hashInviteToken, MIN_TEAM_PASSWORD } from "../lib/invite";
import { useStore } from "../lib/store";

export function ClaimInvite({ token, onDone }: { token: string; onDone: () => void }) {
  const { login } = useAuth();
  const { state, setTeamAccess } = useStore();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [status, setStatus] = useState<"load" | "ok" | "expired" | "invalid">("load");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await previewTeamInvite(token).catch(() => ({ ok: false as const, error: "invalid" }));
      if (cancelled) return;
      if (remote.ok) {
        setTeamName(remote.teamName ?? "ekipa");
        setStatus("ok");
        return;
      }
      const hash = await hashInviteToken(token);
      const team = state.teams.find((item) => item.inviteHash === hash);
      if (cancelled) return;
      if (!team) {
        setStatus(remote.error === "expired" ? "expired" : "invalid");
        return;
      }
      const exp = Date.parse(team.inviteExpires ?? "");
      if (!Number.isFinite(exp) || exp <= Date.now()) {
        setStatus("expired");
        return;
      }
      setTeamName(team.name);
      setStatus("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, state.teams]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = password.trim();
    if (next.length < MIN_TEAM_PASSWORD) {
      setError(`Geslo naj ima vsaj ${MIN_TEAM_PASSWORD} znake.`);
      return;
    }
    if (next !== repeat.trim()) {
      setError("Gesli se ne ujemata.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const remote = await claimTeamInvite(token, next);
      if (remote.ok) {
        await login(next);
        onDone();
        return;
      }
      if (remote.error === "expired") {
        setStatus("expired");
        return;
      }
      if (remote.error === "short") {
        setError(`Geslo naj ima vsaj ${MIN_TEAM_PASSWORD} znake.`);
        return;
      }
      const hash = await hashInviteToken(token);
      const team = state.teams.find((item) => item.inviteHash === hash);
      const exp = Date.parse(team?.inviteExpires ?? "");
      if (!team || !Number.isFinite(exp) || exp <= Date.now()) {
        setStatus(remote.error === "invalid" ? "invalid" : "expired");
        return;
      }
      await setTeamAccess(team.id, next);
      await login(next);
      onDone();
    } catch {
      setError("Gesla ni bilo mogoče shraniti.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="round-title">Nastavi geslo ekipe</h2>
      {status === "load" && <p className="muted">Preverjam povezavo…</p>}
      {status === "invalid" && <p>Ta povezava ni veljavna. Prosi admina za novo.</p>}
      {status === "expired" && <p>Povezava je potekla. Prosi admina za novo.</p>}
      {status === "ok" && (
        <>
          <p>
            Nastavi geslo za <strong>{teamName}</strong>. S tem geslom se potem prijaviš zgoraj desno.
          </p>
          <form className="form-row" onSubmit={(e) => void submit(e)}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Novo geslo"
              autoComplete="new-password"
              aria-label="Novo geslo"
            />
            <input
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="Ponovi geslo"
              autoComplete="new-password"
              aria-label="Ponovi geslo"
            />
            <button className="primary" type="submit" disabled={busy || !password.trim()}>
              {busy ? "…" : "Shrani geslo"}
            </button>
          </form>
          {error && <p className="login-error">{error}</p>}
        </>
      )}
    </section>
  );
}
