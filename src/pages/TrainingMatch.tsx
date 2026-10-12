import { useState } from "react";
import { playerTag } from "../lib/labels";
import { nominatedIds, pairingTemplate, slotLabel } from "../lib/pairings";
import { matchTotals, scoreGame } from "../lib/scoring";
import { useStore } from "../lib/store";
import { formatTrainingDate, trainingMatchTitle } from "../lib/training";
import type { Gender, TrainingSession } from "../lib/types";
import { LineupEditor, PinField } from "./MatchEntry";

function AddPlayerForm({
  onAdd,
}: {
  onAdd: (name: string, gender: Gender, bzs: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [bzs, setBzs] = useState(false);
  return (
    <form
      className="form-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name, gender, bzs);
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
      <button className="ghost" type="submit">
        Vnesi igralca
      </button>
    </form>
  );
}

export function TrainingMatch({
  session,
  ownerTeamId,
  onBack,
}: {
  session: TrainingSession;
  ownerTeamId: string | null;
  onBack: () => void;
}) {
  const {
    state,
    setTrainingDate,
    addTrainingPlayer,
    setTrainingMatchLineup,
    setTrainingMatchPins,
    setTrainingMatchPlayer,
  } = useStore();
  const packed = session.match;
  if (!packed) return <p>Tekma ne obstaja.</p>;

  const owner = ownerTeamId ?? undefined;
  const homeName =
    state.teams.find((t) => t.id === packed.homeTeamId)?.name || packed.homeName || "Domači";
  const awayName =
    state.teams.find((t) => t.id === packed.awayTeamId)?.name || packed.awayName || "Gostje";
  const homeRoster = state.players.filter((p) => p.teamId === packed.homeTeamId);
  const awayRoster = state.players.filter((p) => p.teamId === packed.awayTeamId);
  const asMatch = {
    id: session.id,
    round: 1,
    homeTeamId: packed.homeTeamId ?? "",
    awayTeamId: packed.awayTeamId ?? "",
    homeStarters: packed.homeStarters,
    awayStarters: packed.awayStarters,
    homeBench: packed.homeBench,
    awayBench: packed.awayBench,
    rounds: packed.rounds,
    status: "scheduled" as const,
  };
  const totals = matchTotals(asMatch, state.players);
  const homeNom = nominatedIds(packed.homeStarters, packed.homeBench);
  const awayNom = nominatedIds(packed.awayStarters, packed.awayBench);

  return (
    <section>
      <button className="ghost" type="button" onClick={onBack}>
        ← Vsi treningi
      </button>
      <h2 className="round-title" style={{ marginTop: 12 }}>
        {trainingMatchTitle(session, state.teams)}
      </h2>
      <label className="training-date">
        Datum
        <input
          type="date"
          value={session.date}
          onChange={(e) => {
            if (e.target.value) setTrainingDate(session.id, e.target.value, owner);
          }}
        />
      </label>
      <p className="muted">{formatTrainingDate(session.date)} · trening kot tekma</p>

      <div className="grid-2" style={{ margin: "16px 0" }}>
        <div className="panel">
          <LineupEditor
            label={`${homeName} (A)`}
            side="home"
            roster={homeRoster}
            starters={packed.homeStarters}
            bench={packed.homeBench}
            onChange={(starters, bench) => setTrainingMatchLineup(session.id, "home", starters, bench, owner)}
          />
          <AddPlayerForm
            onAdd={(name, gender, bzs) =>
              addTrainingPlayer(session.id, name, gender, bzs, owner, packed.homeTeamId)
            }
          />
        </div>
        <div className="panel">
          <LineupEditor
            label={`${awayName} (B)`}
            side="away"
            roster={awayRoster}
            starters={packed.awayStarters}
            bench={packed.awayBench}
            onChange={(starters, bench) => setTrainingMatchLineup(session.id, "away", starters, bench, owner)}
          />
          <AddPlayerForm
            onAdd={(name, gender, bzs) =>
              addTrainingPlayer(session.id, name, gender, bzs, owner, packed.awayTeamId)
            }
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="muted">Rezultat (TOČKE)</div>
        <div className="big-score">{totals.complete ? `${totals.homeMatch}:${totals.awayMatch}` : "—"}</div>
        <div className="muted">
          Velike: {totals.homeBig}:{totals.awayBig} · Male: {totals.homeSmall}:{totals.awaySmall} · Keglji:{" "}
          {totals.homePins}:{totals.awayPins}
        </div>
      </div>

      {packed.rounds.map((round, ri) => {
        const pair = pairingTemplate()[ri] ?? [];
        const roundTot = totals.rounds[ri];
        return (
          <div className="scorecard" key={ri} style={{ marginBottom: 16 }}>
            <h3>{ri + 1}. krog</h3>
            <table>
              <thead>
                <tr>
                  <th>S</th>
                  <th>Domači</th>
                  <th>Rez.</th>
                  <th>T</th>
                  <th>T</th>
                  <th>Rez.</th>
                  <th>Gostje</th>
                </tr>
              </thead>
              <tbody>
                {round.games.map((game, gi) => {
                  const duel = scoreGame(game, state.players);
                  const homePlayers = homeRoster.filter((p) => homeNom.includes(p.id));
                  const awayPlayers = awayRoster.filter((p) => awayNom.includes(p.id));
                  const slots = pair[gi];
                  return (
                    <tr key={gi}>
                      <td className="mono">{game.lane}</td>
                      <td>
                        <span className="player-pick">
                          <span className="slot-tag">{slots ? slotLabel("home", slots.homeSlot) : ""}</span>
                          <select
                            value={game.homePlayerId}
                            onChange={(e) =>
                              setTrainingMatchPlayer(session.id, ri, gi, "home", e.target.value, owner)
                            }
                          >
                            <option value="">—</option>
                            {homePlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {playerTag(p)}
                              </option>
                            ))}
                          </select>
                        </span>
                      </td>
                      <td className="mono">
                        <PinField
                          raw={game.homePins}
                          player={homeRoster.find((p) => p.id === game.homePlayerId)}
                          readOnly={false}
                          onChange={(pins) => setTrainingMatchPins(session.id, ri, gi, "home", pins, owner)}
                        />
                      </td>
                      <td className="mono t-cell">{duel ? duel.homeTotal : "—"}</td>
                      <td className="mono t-cell">{duel ? duel.awayTotal : "—"}</td>
                      <td className="mono">
                        <PinField
                          raw={game.awayPins}
                          player={awayRoster.find((p) => p.id === game.awayPlayerId)}
                          readOnly={false}
                          onChange={(pins) => setTrainingMatchPins(session.id, ri, gi, "away", pins, owner)}
                        />
                      </td>
                      <td>
                        <span className="player-pick">
                          <span className="slot-tag">{slots ? slotLabel("away", slots.awaySlot) : ""}</span>
                          <select
                            value={game.awayPlayerId}
                            onChange={(e) =>
                              setTrainingMatchPlayer(session.id, ri, gi, "away", e.target.value, owner)
                            }
                          >
                            <option value="">—</option>
                            {awayPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {playerTag(p)}
                              </option>
                            ))}
                          </select>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {roundTot && (
              <p className="muted" style={{ marginTop: 10 }}>
                Seštevek T: {roundTot.homeSmall}:{roundTot.awaySmall}
                {roundTot.complete
                  ? ` · velike ${roundTot.homeBig}:${roundTot.awayBig} · keglji ${roundTot.homePins}:${roundTot.awayPins}`
                  : ""}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
