import { useState } from "react";
import { exportRegistrationPdf } from "../lib/exportPdf";
import type { Gender } from "../lib/types";
import { useStore } from "../lib/store";

export function TeamDetail({ teamId, onBack }: { teamId: string; onBack: () => void }) {
  const { state, renameTeam, updateTeam, addPlayer, updatePlayer, removePlayer } = useStore();
  const team = state.teams.find((t) => t.id === teamId);
  const players = state.players.filter((p) => p.teamId === teamId);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [bzs, setBzs] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!team) return <p>Ekipa ne obstaja.</p>;

  return (
    <section className="panel">
      <button className="ghost" onClick={onBack}>
        ← Ekipe
      </button>
      <h2 style={{ margin: "12px 0" }}>{team.name}</h2>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          renameTeam(team.id, team.name);
        }}
      >
        <input
          value={team.name}
          onChange={(e) => renameTeam(team.id, e.target.value)}
          aria-label="Ime ekipe"
        />
      </form>
      <div className="form-row" style={{ marginTop: 12 }}>
        <input
          value={team.captain ?? ""}
          onChange={(e) => updateTeam(team.id, { captain: e.target.value })}
          placeholder="Vodja ekipe"
          aria-label="Vodja ekipe"
        />
        <input
          value={team.phone ?? ""}
          onChange={(e) => updateTeam(team.id, { phone: e.target.value })}
          placeholder="Tel. številka"
          aria-label="Tel. številka"
        />
        <input
          value={team.email ?? ""}
          onChange={(e) => updateTeam(team.id, { email: e.target.value })}
          placeholder="E-pošta"
          type="email"
          aria-label="E-pošta"
        />
        <button
          className="ghost"
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await exportRegistrationPdf(state, team.id);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Pripravljam…" : "Izvozi prijavni list"}
        </button>
      </div>
      <h3 style={{ marginTop: 24 }}>Igralci ({players.length})</h3>
      <p className="muted">Seznam je neomejen. Pred tekmo izbereš 4 + do 2 menjavi. Člani gredo na prijavni list.</p>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addPlayer(team.id, name, gender, bzs);
          setName("");
          setGender("M");
          setBzs(false);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ime igralca" />
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="M">Moški</option>
          <option value="F">Ženska (+8)</option>
        </select>
        <label className="muted">
          <input type="checkbox" checked={bzs} onChange={(e) => setBzs(e.target.checked)} /> član BZS (−8)
        </label>
        <button className="primary" type="submit">
          Dodaj
        </button>
      </form>
      <div className="list" style={{ marginTop: 16 }}>
        {players.map((p) => (
          <div key={p.id} className="form-row" style={{ justifyContent: "space-between" }}>
            <strong>{p.name}</strong>
            <label className="muted">
              <input
                type="checkbox"
                checked={p.gender === "F"}
                onChange={(e) => updatePlayer({ ...p, gender: e.target.checked ? "F" : "M" })}
              />{" "}
              ženska
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={p.bzsMember}
                onChange={(e) => updatePlayer({ ...p, bzsMember: e.target.checked })}
              />{" "}
              BZS
            </label>
            <button className="danger" type="button" onClick={() => removePlayer(p.id)}>
              Odstrani
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
