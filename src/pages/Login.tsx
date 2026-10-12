import { useState } from "react";
import { useAuth } from "../lib/auth";

export function Login() {
  const { admin, ready, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  if (admin) return null;

  return (
    <form
      className="login-form header-login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(false);
        const ok = await login(password);
        setBusy(false);
        if (ok) {
          setPassword("");
        } else {
          setError(true);
        }
      }}
    >
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Geslo"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Admin geslo"
      />
      <button className="ghost" type="submit" disabled={busy || !password}>
        {busy ? "…" : "Prijava"}
      </button>
      {error && <span className="login-error">Napačno geslo.</span>}
    </form>
  );
}
