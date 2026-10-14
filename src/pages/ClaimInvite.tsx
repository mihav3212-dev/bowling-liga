import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { claimTeamInvite, previewTeamInvite } from "../lib/leagueApi";
import { formatInviteCode, hashInviteToken, MIN_TEAM_PASSWORD, normalizeInviteToken } from "../lib/invite";
import { useStore } from "../lib/store";

export function ClaimInvite({
  token: initialToken,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const { login } = useAuth();
  const { state, setTeamAccess } = useStore();
  const [token, setToken] = useState(() => normalizeInviteToken(initialToken));
  const [codeInput, setCodeInput] = useState(() => formatInviteCode(initialToken) || "");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [status, setStatus] = useState<"code" | "load" | "ok" | "expired" | "invalid">(
    normalizeInviteToken(initialToken) ? "load" : "code",
  );
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const next = normalizeInviteToken(initialToken);
    if (!next) {
      setStatus("code");
      return;
    }
    setToken(next);
    setCodeInput(formatInviteCode(next));
    setStatus("load");
  }, [initialToken]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setStatus("load");
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

  const applyCode = (raw: string) => {
    const next = normalizeInviteToken(raw);
    if (next.length < 6) {
      setError("Koda je prekratka. Preveri sporočilo od admina.");
      return;
    }
    setError("");
    setToken(next);
    setCodeInput(formatInviteCode(next));
  };

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

  const codeForm = (
    <form
      className="form-row"
      onSubmit={(e) => {
        e.preventDefault();
        applyCode(codeInput);
      }}
    >
      <input
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
        placeholder="npr. AB3K-9M2P"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label="Koda ekipe"
      />
      <button className="primary" type="submit">
        Naprej
      </button>
    </form>
  );

  return (
    <section className="panel">
      <button className="ghost" type="button" onClick={onDone}>
        ← Nazaj
      </button>
      <h2 className="round-title">Nastavi geslo ekipe</h2>
      {status === "code" && (
        <>
          <p className="muted">Vpiši kodo, ki ti jo je poslal admin (npr. v Messengerju).</p>
          {codeForm}
          {error && <p className="login-error">{error}</p>}
        </>
      )}
      {status === "load" && <p className="muted">Preverjam kodo…</p>}
      {status === "invalid" && (
        <>
          <p>Ta koda / povezava ni veljavna. Preveri kodo ali prosi admina za novo.</p>
          <p className="muted">Vpiši kodo znova:</p>
          {codeForm}
          {error && <p className="login-error">{error}</p>}
        </>
      )}
      {status === "expired" && (
        <>
          <p>Koda je potekla. Prosi admina za novo.</p>
          <p className="muted">Če imaš novo kodo, jo vpiši tukaj:</p>
          {codeForm}
        </>
      )}
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
