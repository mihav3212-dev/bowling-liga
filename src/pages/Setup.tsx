import { useState } from "react";

export function Setup({ onDone }: { onDone: () => void }) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3306");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("bowling_liga");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="app-shell">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Namestitev</h2>
        <p className="muted">
          Datoteke .env ne rabiš. V phpMyAdmin najprej ustvari prazno bazo, sem pa vpiši iste podatke kot za
          MySQL uporabnika.
        </p>
        <form
          className="setup-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  host,
                  port: Number(port) || 3306,
                  user,
                  password,
                  database,
                  adminPassword,
                }),
              });
              const data = (await res.json()) as { ok?: boolean; error?: string };
              if (!res.ok || !data.ok) {
                setError(data.error || "Namestitev ni uspela.");
                return;
              }
              onDone();
            } catch {
              setError("Strežnik se ni odzval.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            MySQL gostitelj
            <input value={host} onChange={(e) => setHost(e.target.value)} autoComplete="off" />
          </label>
          <label>
            Vrata
            <input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
          </label>
          <label>
            MySQL uporabnik
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
          </label>
          <label>
            MySQL geslo
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Ime baze
            <input value={database} onChange={(e) => setDatabase(e.target.value)} />
          </label>
          <label>
            Geslo admina (prijava v ligo)
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={busy || !user.trim() || !database.trim() || !adminPassword.trim()}
          >
            {busy ? "Povezujem…" : "Shrani in poveži"}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </section>
    </div>
  );
}
