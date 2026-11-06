import { useState } from "react";
import { useAuth } from "../lib/auth";
import { looksLikeInviteCode, normalizeInviteToken } from "../lib/invite";
import { previewTeamInvite } from "../lib/leagueApi";

export function Login({ onInviteCode }: { onInviteCode?: (token: string) => void }) {
  const { admin, display, teamId, ready, login, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  if (admin) return null;

  if (display) {
    return (
      <div className="header-login-status">
        <span className="muted">Prikaz TV</span>
        <a className="ghost header-logout" href="/?display=live">
          TV živo
        </a>
        <a className="ghost header-logout" href="/?display=board">
          TV liga
        </a>
        <button className="ghost header-logout" type="button" onClick={() => void logout()}>
          Odjava
        </button>
      </div>
    );
  }

  if (teamId) {
    return (
      <button className="ghost header-logout" type="button" onClick={() => void logout()}>
        Odjava
      </button>
    );
  }

  return (
    <form
      className="login-form header-login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(false);
        const raw = password.trim();
        const ok = await login(raw);
        if (ok) {
          setPassword("");
          setBusy(false);
          return;
        }
        if (onInviteCode && looksLikeInviteCode(raw)) {
          const token = normalizeInviteToken(raw);
          const preview = await previewTeamInvite(token).catch(() => ({ ok: false as const }));
          if (preview.ok) {
            setPassword("");
            setBusy(false);
            onInviteCode(token);
            return;
          }
        }
        setBusy(false);
        setError(true);
      }}
    >
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Geslo ali koda"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Geslo ali koda ekipe"
      />
      <button className="ghost" type="submit" disabled={busy || !password}>
        {busy ? "…" : "Prijava"}
      </button>
      {error && <span className="login-error">Napačno geslo ali koda.</span>}
    </form>
  );
}
