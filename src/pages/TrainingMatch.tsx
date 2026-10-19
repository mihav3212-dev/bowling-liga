import { useMemo, useState } from "react";
import { playerTag } from "../lib/labels";
import { lineupSize, nominatedIds, pairingTemplate, slotLabel } from "../lib/pairings";
import { lineupLocked, matchTotals, scoreGame } from "../lib/scoring";
import { useStore } from "../lib/store";
import { formatTrainingDate, trainingAsMatch, trainingMatchTitle } from "../lib/training";
import type { Gender, Player, TrainingSession } from "../lib/types";
import { LineupEditor, LineupReadout, PinField } from "./MatchEntry";

function playerName(roster: Player[], id: string): string {
  const player = roster.find((p) => p.id === id);
  return player ? playerTag(player) : "—";
}

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
    state.teams.find((t) => t.id === packed.homeTeamId)?.name || packed.homeName || "Skupina A";
  const awayName =
    state.teams.find((t) => t.id === packed.awayTeamId)?.name || packed.awayName || "Skupina B";

  /** Vsi igralci sezone — lahko mečejo iz različnih ekip. */
  const allRoster = useMemo(
    () => [...state.players].sort((a, b) => a.name.localeCompare(b.name, "sl")),
    [state.players],
  );
  const teamNameOf = (p: Player) => state.teams.find((t) => t.id === p.teamId)?.name ?? "";
  const formatPlayer = (p: Player) => {
    const team = teamNameOf(p);
    return team ? `${playerTag(p)} · ${team}` : playerTag(p);
  };

  const filledHome = packed.homeStarters.filter(Boolean).length;
  const filledAway = packed.awayStarters.filter(Boolean).length;
  const initialSlots = Math.min(
    4,
    Math.max(2, Math.max(filledHome, filledAway, 2)),
  );
  const [starterCount, setStarterCount] = useState(initialSlots);

  const asMatch = trainingAsMatch(session.id, packed);
  const totals = matchTotals(asMatch, state.players);
  const homeNom = nominatedIds(packed.homeStarters, packed.homeBench);
  const awayNom = nominatedIds(packed.awayStarters, packed.awayBench);
  const playersLocked = lineupLocked(packed.rounds);
  const nominated = useMemo(
    () => allRoster.filter((p) => homeNom.includes(p.id) || awayNom.includes(p.id)),
    [allRoster, homeNom, awayNom],
  );

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
      <p className="muted">
        {formatTrainingDate(session.date)} · trening kot tekma · igralci iz poljubnih ekip
      </p>
      {!playersLocked && (
        <label className="training-date" style={{ marginTop: 8 }}>
          Število mest na stran (2–4)
          <select
            value={starterCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              setStarterCount(n);
              const trim = (side: "home" | "away", starters: string[], bench: string[]) => {
                const next = [...starters];
                while (next.length < 4) next.push("");
                for (let i = n; i < 4; i++) next[i] = "";
                setTrainingMatchLineup(session.id, side, next.slice(0, 4), bench, owner);
              };
              trim("home", packed.homeStarters, packed.homeBench);
              trim("away", packed.awayStarters, packed.awayBench);
            }}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
      )}
      {playersLocked && (
        <p className="muted">
          Sestava je zaklenjena, ker so vneseni rezultati 1. kroga. Če jo želiš spremeniti, najprej zbriši
          keglje v 1. krogu.
        </p>
      )}

      <div className="grid-2" style={{ margin: "16px 0" }}>
        <div className="panel">
          {playersLocked ? (
            <LineupReadout
              label={`${homeName} (A)`}
              roster={allRoster}
              starters={packed.homeStarters}
              bench={packed.homeBench}
            />
          ) : (
            <LineupEditor
              label={`${homeName} (A)`}
              side="home"
              roster={allRoster}
              starters={packed.homeStarters}
              bench={packed.homeBench}
              starterCount={starterCount}
              showBench={starterCount >= 4}
              hint={`Izberi ${starterCount} igralce (lahko iz različnih ekip).`}
              formatPlayer={formatPlayer}
              searchIn={teamNameOf}
              onChange={(starters, bench) =>
                setTrainingMatchLineup(session.id, "home", starters, bench, owner)
              }
            />
          )}
          <AddPlayerForm
            onAdd={(name, gender, bzs) =>
              addTrainingPlayer(session.id, name, gender, bzs, owner, packed.homeTeamId)
            }
          />
        </div>
        <div className="panel">
          {playersLocked ? (
            <LineupReadout
              label={`${awayName} (B)`}
              roster={allRoster}
              starters={packed.awayStarters}
              bench={packed.awayBench}
            />
          ) : (
            <LineupEditor
              label={`${awayName} (B)`}
              side="away"
              roster={allRoster}
              starters={packed.awayStarters}
              bench={packed.awayBench}
              starterCount={starterCount}
              showBench={starterCount >= 4}
              hint={`Izberi ${starterCount} igralce (lahko iz različnih ekip).`}
              formatPlayer={formatPlayer}
              searchIn={teamNameOf}
              onChange={(starters, bench) =>
                setTrainingMatchLineup(session.id, "away", starters, bench, owner)
              }
            />
          )}
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
        const size = lineupSize(packed.homeStarters, packed.awayStarters);
        const pair = pairingTemplate(size)[ri] ?? [];
        const roundTot = totals.rounds[ri];
        const lockRoundPlayers = ri === 0 && playersLocked;
        const visibleGames = round.games
          .map((game, gi) => ({ game, gi }))
          .filter(({ game, gi }) => {
            const slots = pair[gi];
            if (!slots) return Boolean(game.homePlayerId && game.awayPlayerId);
            const homeId = packed.homeStarters[slots.homeSlot];
            const awayId = packed.awayStarters[slots.awaySlot];
            return Boolean(
              (homeId && awayId) || (game.homePlayerId && game.awayPlayerId),
            );
          });
        if (visibleGames.length === 0) return null;
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
                {visibleGames.map(({ game, gi }) => {
                  const duel = scoreGame(game, state.players);
                  const homePlayers = nominated.filter((p) => homeNom.includes(p.id));
                  const awayPlayers = nominated.filter((p) => awayNom.includes(p.id));
                  const slots = pair[gi];
                  return (
                    <tr key={gi}>
                      <td className="mono">{game.lane}</td>
                      <td>
                        <span className="player-pick">
                          <span className="slot-tag">{slots ? slotLabel("home", slots.homeSlot) : ""}</span>
                          {lockRoundPlayers ? (
                            playerName(allRoster, game.homePlayerId)
                          ) : (
                            <select
                              value={game.homePlayerId}
                              onChange={(e) =>
                                setTrainingMatchPlayer(session.id, ri, gi, "home", e.target.value, owner)
                              }
                            >
                              <option value="">—</option>
                              {homePlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatPlayer(p)}
                                </option>
                              ))}
                            </select>
                          )}
                        </span>
                      </td>
                      <td className="mono">
                        <PinField
                          raw={game.homePins}
                          player={allRoster.find((p) => p.id === game.homePlayerId)}
                          readOnly={false}
                          onChange={(pins) => setTrainingMatchPins(session.id, ri, gi, "home", pins, owner)}
                        />
                      </td>
                      <td className="mono t-cell">{duel ? duel.homeTotal : "—"}</td>
                      <td className="mono t-cell">{duel ? duel.awayTotal : "—"}</td>
                      <td className="mono">
                        <PinField
                          raw={game.awayPins}
                          player={allRoster.find((p) => p.id === game.awayPlayerId)}
                          readOnly={false}
                          onChange={(pins) => setTrainingMatchPins(session.id, ri, gi, "away", pins, owner)}
                        />
                      </td>
                      <td>
                        <span className="player-pick">
                          <span className="slot-tag">{slots ? slotLabel("away", slots.awaySlot) : ""}</span>
                          {lockRoundPlayers ? (
                            playerName(allRoster, game.awayPlayerId)
                          ) : (
                            <select
                              value={game.awayPlayerId}
                              onChange={(e) =>
                                setTrainingMatchPlayer(session.id, ri, gi, "away", e.target.value, owner)
                              }
                            >
                              <option value="">—</option>
                              {awayPlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatPlayer(p)}
                                </option>
                              ))}
                            </select>
                          )}
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
