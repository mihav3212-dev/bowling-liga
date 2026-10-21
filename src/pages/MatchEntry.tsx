import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { exportMatchPdf } from "../lib/exportPdf";
import { playerTag, parsePins, formatMatchWhen } from "../lib/labels";
import { nominatedIds, pairingTemplate, slotLabel } from "../lib/pairings";
import { canEnterPins, teamPerms } from "../lib/access";
import { lineupsRevealed, teamMatchSide } from "../lib/lineup";
import { lineupLocked, matchPlayerStats, matchTotals, scoreGame, scoredPins } from "../lib/scoring";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";
import type { Player } from "../lib/types";

/** Kot TV: hitro osveževanje, da vsi vidijo isto vpisano. */
const MATCH_SYNC_MS = 800;

function playerName(roster: Player[], id: string): string {
  const player = roster.find((p) => p.id === id);
  return player ? playerTag(player) : "—";
}

export function PinField({
  raw,
  player,
  readOnly,
  onChange,
  onEditingChange,
}: {
  raw: number | null;
  player?: Player;
  readOnly: boolean;
  onChange: (pins: number | null) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const final = scoredPins(raw, player);
  if (readOnly) return <>{final ?? "—"}</>;
  const showAdj = raw != null && final != null && final !== raw;
  return (
    <span className="pin-entry">
      <input
        className="mono"
        inputMode="numeric"
        value={raw ?? ""}
        onChange={(e) => onChange(parsePins(e.target.value))}
        onFocus={() => onEditingChange?.(true)}
        onBlur={() => onEditingChange?.(false)}
      />
      {showAdj ? <span className="pin-adj">({final})</span> : null}
    </span>
  );
}

export function LineupReadout({
  label,
  roster,
  starters,
  bench,
}: {
  label: string;
  roster: Player[];
  starters: string[];
  bench: string[];
}) {
  const named = starters.filter(Boolean);
  const reserves = bench.filter(Boolean);
  return (
    <div>
      <h3>{label}</h3>
      {named.length === 0 ? (
        <p className="muted">Sestava ni vnesena.</p>
      ) : (
        <ol className="lineup-list">
          {named.map((id) => (
            <li key={id}>{playerName(roster, id)}</li>
          ))}
        </ol>
      )}
      {reserves.length > 0 && (
        <p className="muted">Menjave: {reserves.map((id) => playerName(roster, id)).join(", ")}</p>
      )}
    </div>
  );
}

export function LineupEditor({
  label,
  side,
  roster,
  starters,
  bench,
  onChange,
  onEditingChange,
  starterCount = 4,
  showBench = true,
  hint,
  formatPlayer,
  searchIn,
}: {
  label: string;
  side: "home" | "away";
  roster: Player[];
  starters: string[];
  bench: string[];
  onChange: (starters: string[], bench: string[]) => void;
  onEditingChange?: (editing: boolean) => void;
  /** Koliko mest A1… (2–4). Ostala mesta ostanejo prazna. */
  starterCount?: number;
  showBench?: boolean;
  hint?: string;
  formatPlayer?: (p: Player) => string;
  /** Dodatno iskanje (npr. ime ekipe). */
  searchIn?: (p: Player) => string;
}) {
  const [query, setQuery] = useState("");
  const slots = Math.min(4, Math.max(2, starterCount));
  const used = new Set([...starters, ...bench].filter(Boolean));
  const labelOf = formatPlayer ?? playerTag;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...roster].sort((a, b) => a.name.localeCompare(b.name, "sl"));
    if (!q) return list;
    return list.filter((p) => {
      const hay = `${p.name} ${searchIn?.(p) ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [roster, query, searchIn]);
  const options = (current: string) => {
    const pool = filtered.filter((p) => p.id === current || !used.has(p.id));
    if (current && !pool.some((p) => p.id === current)) {
      const extra = roster.find((p) => p.id === current);
      if (extra) return [extra, ...pool];
    }
    return pool;
  };
  const padStarters = (next: string[]) => {
    const out = [...next];
    while (out.length < 4) out.push("");
    return out.slice(0, 4);
  };

  return (
    <div>
      <h3>{label}</h3>
      <p className="muted">
        {hint ?? `Izberi ${slots} + do 2 menjavi iz ${roster.length} igralcev.`}
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Išči igralca"
      />
      {Array.from({ length: slots }, (_, i) => (
        <select
          key={`s${i}`}
          value={starters[i] ?? ""}
          onFocus={() => onEditingChange?.(true)}
          onBlur={() => onEditingChange?.(false)}
          onChange={(e) => {
            const next = padStarters(starters);
            next[i] = e.target.value;
            for (let j = slots; j < 4; j++) next[j] = "";
            onChange(next, bench);
          }}
        >
          <option value="">{slotLabel(side, i)}</option>
          {options(starters[i] ?? "").map((p) => (
            <option key={p.id} value={p.id}>
              {labelOf(p)}
            </option>
          ))}
        </select>
      ))}
      {showBench &&
        [0, 1].map((i) => (
          <select
            key={`b${i}`}
            value={bench[i] ?? ""}
            onFocus={() => onEditingChange?.(true)}
            onBlur={() => onEditingChange?.(false)}
            onChange={(e) => {
              const next = [...bench];
              next[i] = e.target.value;
              onChange(padStarters(starters), next.filter(Boolean));
            }}
          >
            <option value="">{slotLabel(side, i + 4)}</option>
            {options(bench[i] ?? "").map((p) => (
              <option key={p.id} value={p.id}>
                {labelOf(p)}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
}

export function MatchEntry({
  matchId,
  onBack,
  readOnly = false,
  lineupTeamId = null,
}: {
  matchId: string;
  onBack: () => void;
  readOnly?: boolean;
  lineupTeamId?: string | null;
}) {
  const {
    state,
    remote,
    setLineup,
    setPins,
    setRoundPlayer,
    saveMatchLineupNow,
    saveShownMatch,
    syncFromRemote,
  } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const editingPinsRef = useRef(false);
  const editingLineupRef = useRef(false);
  const syncRef = useRef(syncFromRemote);
  syncRef.current = syncFromRemote;
  const match = state.matches.find((m) => m.id === matchId);

  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || editingPinsRef.current || editingLineupRef.current) return;
      await syncRef.current();
    };
    void tick();
    const poll = window.setInterval(() => void tick(), MATCH_SYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [remote, matchId]);

  if (!match) return <p>Tekma ne obstaja.</p>;
  const ownSide = teamMatchSide(match, lineupTeamId);
  const viewerTeam = lineupTeamId ? state.teams.find((t) => t.id === lineupTeamId) : undefined;
  const perms = teamPerms(viewerTeam);
  const teamLineup = Boolean(lineupTeamId && ownSide && perms.lineup);
  const canResults = Boolean(lineupTeamId && ownSide && (perms.results || perms.resultsEdit));
  const hideScores = Boolean(lineupTeamId && ownSide && !canResults);
  const pinsReadOnly = readOnly || (Boolean(lineupTeamId) && !canResults);

  const home = state.teams.find((t) => t.id === match.homeTeamId);
  const away = state.teams.find((t) => t.id === match.awayTeamId);
  const homeRoster = state.players.filter((p) => p.teamId === match.homeTeamId);
  const awayRoster = state.players.filter((p) => p.teamId === match.awayTeamId);
  const totals = matchTotals(match, state.players);
  const homeNom = nominatedIds(match.homeStarters, match.homeBench);
  const awayNom = nominatedIds(match.awayStarters, match.awayBench);
  let homeGames = 0;
  let awayGames = 0;
  for (const round of match.rounds) {
    for (const game of round.games) {
      if (game.homePins != null) homeGames += 1;
      if (game.awayPins != null) awayGames += 1;
    }
  }
  const homeAvg = homeGames ? totals.homePins / homeGames : null;
  const awayAvg = awayGames ? totals.awayPins / awayGames : null;
  const playerStats = matchPlayerStats(match, state.players);
  const fmtAvg = (n: number | null) =>
    n != null ? n.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  const playersLocked = (readOnly && !teamLineup) || lineupLocked(match.rounds);
  const homeEditable = lineupTeamId
    ? ownSide === "home" && perms.lineup && !playersLocked
    : !playersLocked;
  const awayEditable = lineupTeamId
    ? ownSide === "away" && perms.lineup && !playersLocked
    : !playersLocked;
  const revealed = lineupsRevealed(match);
  const hideHomeLineup = Boolean(lineupTeamId && ownSide === "away" && !revealed);
  const hideAwayLineup = Boolean(lineupTeamId && ownSide === "home" && !revealed);

  return (
    <section>
      <button className="ghost" onClick={onBack}>
        ← Nazaj
      </button>
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="match-heading">
          <div>
            <div className="muted">
              {match.round}. kolo
              {match.startsAt ? ` · ${formatMatchWhen(match.startsAt)}` : ""}
            </div>
            <h2 className="match-title">
              {home?.name} — {away?.name}
            </h2>
          </div>
          <div>
            {!hideScores && (
              <>
                <div className="muted">Rezultat (TOČKE)</div>
                <div className="big-score">
                  {totals.complete ? `${totals.homeMatch}:${totals.awayMatch}` : "—"}
                </div>
                <div className="muted">
                  Velike: {totals.homeBig}:{totals.awayBig}
                  {totals.complete ? " (krogi + 2 za več kegljev)" : ""}
                  {" · "}
                  Male: {totals.homeSmall}:{totals.awaySmall}
                  {" · "}
                  Keglji: {totals.homePins}:{totals.awayPins}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {teamLineup && !playersLocked && (
        <p className="muted" style={{ margin: "12px 0 0" }}>
          Vnesi svojo sestavo ({ownSide === "home" ? "A1–A6" : "B1–B6"}). Nasprotnikova ostane skrita do
          začetka tekme.
          {canResults ? "" : " Rezultate vnaša admin, razen če imaš dovoljenje."}
        </p>
      )}
      {playersLocked && teamLineup && (
        <p className="muted" style={{ margin: "12px 0 0" }}>
          Sestava je zaklenjena, ker so že vneseni rezultati 1. kroga.
        </p>
      )}
      {playersLocked && !readOnly && !lineupTeamId && (
        <p className="muted" style={{ margin: "12px 0 0" }}>
          Sestava je zaklenjena, ker so vneseni rezultati 1. kroga. Če jo želiš spremeniti, najprej zbriši
          keglje v 1. krogu.
        </p>
      )}
      <div className="grid-2" style={{ margin: "16px 0" }}>
        <div className="panel">
          {hideHomeLineup ? (
            <div>
              <h3>{home?.name ?? "Domači"}</h3>
              <p className="muted">Sestava nasprotnika je skrita do začetka tekme.</p>
            </div>
          ) : homeEditable ? (
            <LineupEditor
              label={`${home?.name ?? "Domači"} (A)`}
              side="home"
              roster={homeRoster}
              starters={match.homeStarters}
              bench={match.homeBench}
              onChange={(starters, bench) => setLineup(match.id, "home", starters, bench)}
              onEditingChange={(editing) => {
                editingLineupRef.current = editing;
              }}
            />
          ) : (
            <LineupReadout
              label={home?.name ?? "Domači"}
              roster={homeRoster}
              starters={match.homeStarters}
              bench={match.homeBench}
            />
          )}
        </div>
        <div className="panel">
          {hideAwayLineup ? (
            <div>
              <h3>{away?.name ?? "Gostje"}</h3>
              <p className="muted">Sestava nasprotnika je skrita do začetka tekme.</p>
            </div>
          ) : awayEditable ? (
            <LineupEditor
              label={`${away?.name ?? "Gostje"} (B)`}
              side="away"
              roster={awayRoster}
              starters={match.awayStarters}
              bench={match.awayBench}
              onChange={(starters, bench) => setLineup(match.id, "away", starters, bench)}
              onEditingChange={(editing) => {
                editingLineupRef.current = editing;
              }}
            />
          ) : (
            <LineupReadout
              label={away?.name ?? "Gostje"}
              roster={awayRoster}
              starters={match.awayStarters}
              bench={match.awayBench}
            />
          )}
        </div>
      </div>

      {!hideScores && !pinsReadOnly && (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Če igralec (ali ekipa) manjka, vpiši <strong>0</strong> kegljev — nasprotnik avtomatsko dobi
          zmago v tistem dvoboju.
        </p>
      )}
      {!hideScores && match.rounds.map((round, ri) => {
        const pair = pairingTemplate()[ri] ?? [];
        const roundTot = totals.rounds[ri];
        const lockRoundPlayers = pinsReadOnly || (Boolean(lineupTeamId) && !perms.lineup) || (ri === 0 && playersLocked);
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
                <th>Rez.</th>
                <th>Gostje</th>
              </tr>
            </thead>
            <tbody>
              {round.games.map((game, gi) => {
                const duel = scoreGame(game, state.players);
                const homePlayers = homeRoster.filter((p) => homeNom.includes(p.id));
                const awayPlayers = awayRoster.filter((p) => awayNom.includes(p.id));
                const homeTaken = new Set(
                  round.games.map((g, i) => (i === gi ? "" : g.homePlayerId)).filter(Boolean),
                );
                const awayTaken = new Set(
                  round.games.map((g, i) => (i === gi ? "" : g.awayPlayerId)).filter(Boolean),
                );
                const slots = pair[gi];
                return (
                  <tr key={gi} className="duel-row">
                    <td className="mono duel-lane" data-label="Steza">{game.lane}</td>
                    <td className="duel-home" data-label="Domači">
                      <span className="player-pick">
                        <span className="slot-tag">{slots ? slotLabel("home", slots.homeSlot) : ""}</span>
                        {lockRoundPlayers ? (
                          playerName(homeRoster, game.homePlayerId)
                        ) : (
                          <select
                            value={game.homePlayerId}
                            onFocus={() => {
                              editingLineupRef.current = true;
                            }}
                            onBlur={() => {
                              editingLineupRef.current = false;
                            }}
                            onChange={(e) => setRoundPlayer(match.id, ri, gi, "home", e.target.value)}
                          >
                            <option value="">—</option>
                            {homePlayers
                              .filter((p) => p.id === game.homePlayerId || !homeTaken.has(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {playerTag(p)}
                                </option>
                              ))}
                          </select>
                        )}
                      </span>
                    </td>
                    <td className="mono duel-pins-home" data-label="Keglji">
                      <PinField
                        raw={game.homePins}
                        player={homeRoster.find((p) => p.id === game.homePlayerId)}
                        readOnly={
                          pinsReadOnly ||
                          (Boolean(lineupTeamId) &&
                            !canEnterPins(viewerTeam, game.homePins))
                        }
                        onChange={(pins) => setPins(match.id, ri, gi, "home", pins)}
                        onEditingChange={(editing) => {
                          editingPinsRef.current = editing;
                        }}
                      />
                    </td>
                    <td className="mono t-cell t-duel" data-label="T">
                      {duel ? (
                        <>
                          <span>{duel.homeTotal}</span>
                          <span className="t-sep">:</span>
                          <span>{duel.awayTotal}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono duel-pins-away" data-label="Keglji">
                      <PinField
                        raw={game.awayPins}
                        player={awayRoster.find((p) => p.id === game.awayPlayerId)}
                        readOnly={
                          pinsReadOnly ||
                          (Boolean(lineupTeamId) &&
                            !canEnterPins(viewerTeam, game.awayPins))
                        }
                        onChange={(pins) => setPins(match.id, ri, gi, "away", pins)}
                        onEditingChange={(editing) => {
                          editingPinsRef.current = editing;
                        }}
                      />
                    </td>
                    <td className="duel-away" data-label="Gostje">
                      <span className="player-pick">
                        <span className="slot-tag">{slots ? slotLabel("away", slots.awaySlot) : ""}</span>
                        {lockRoundPlayers ? (
                          playerName(awayRoster, game.awayPlayerId)
                        ) : (
                          <select
                            value={game.awayPlayerId}
                            onFocus={() => {
                              editingLineupRef.current = true;
                            }}
                            onBlur={() => {
                              editingLineupRef.current = false;
                            }}
                            onChange={(e) => setRoundPlayer(match.id, ri, gi, "away", e.target.value)}
                          >
                            <option value="">—</option>
                            {awayPlayers
                              .filter((p) => p.id === game.awayPlayerId || !awayTaken.has(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {playerTag(p)}
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
                ? ` · velike tega kroga ${roundTot.homeBig}:${roundTot.awayBig} · keglji ${roundTot.homePins}:${roundTot.awayPins}`
                : ""}
            </p>
          )}
        </div>
        );
      })}

      {!hideScores && <div className="scorecard match-summary">
        <h3>Seštevek</h3>
        <table>
          <thead>
            <tr>
              <th />
              <th>Skupaj</th>
              <th>Povp.</th>
              <th>Sk. točk</th>
              <th>Rezultat</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                {
                  name: home?.name ?? "Domači",
                  pins: totals.homePins,
                  avg: homeAvg,
                  velike: totals.homeBig,
                  rezultat: totals.complete ? totals.homeMatch : "—",
                  win: totals.complete && totals.homeMatch === 2,
                },
                {
                  name: away?.name ?? "Gostje",
                  pins: totals.awayPins,
                  avg: awayAvg,
                  velike: totals.awayBig,
                  rezultat: totals.complete ? totals.awayMatch : "—",
                  win: totals.complete && totals.awayMatch === 2,
                },
              ] as const
            ).map((row) => (
              <tr key={row.name}>
                <td className="team-cell">{row.name}</td>
                <td className="sum-box mono">{row.pins}</td>
                <td className="sum-box mono">
                  {fmtAvg(row.avg)}
                </td>
                <td className="points-box mono">{row.velike}</td>
                <td className={`result-box mono${row.win ? " is-win" : ""}`}>{row.rezultat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {!hideScores && playerStats.length > 0 && (
        <div className="scorecard match-summary match-player-stats">
          <h3>Po igralcih</h3>
          <table>
            <thead>
              <tr>
                <th>Igralec</th>
                <th>Male</th>
                <th>Keglji</th>
                <th>Povp.</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { side: "home" as const, label: home?.name ?? "Domači" },
                  { side: "away" as const, label: away?.name ?? "Gostje" },
                ] as const
              ).map((group) => {
                const rows = playerStats.filter((r) => r.side === group.side);
                if (!rows.length) return null;
                return (
                  <Fragment key={group.side}>
                    <tr className="match-player-team-row">
                      <td colSpan={4}>{group.label}</td>
                    </tr>
                    {rows.map((row) => (
                      <tr key={`${row.side}-${row.playerId}`}>
                        <td className="team-cell">{row.name}</td>
                        <td className="points-box mono">{row.small}</td>
                        <td className="sum-box mono">{row.pins}</td>
                        <td className="sum-box mono">{fmtAvg(row.average)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="match-actions">
        {!hideScores && (
          <PdfButton label="Izvozi zapisnik PDF" onExport={() => exportMatchPdf(state, match.id)} />
        )}
        {(!readOnly || teamLineup) && (
          <>
            <button
              className="primary"
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setSaveNote("");
                const ok = teamLineup
                  ? await saveMatchLineupNow(match.id)
                  : await saveShownMatch(match.id);
                setSaving(false);
                if (!ok) {
                  setSaveNote("Shranjevanje ni uspelo. Poskusi znova, ne zapiraj tekme.");
                  return;
                }
                onBack();
              }}
            >
              {saving ? "Shranjujem…" : "Shrani"}
            </button>
            <span className="muted">
              {saveNote ||
                (teamLineup
                  ? "Sestava se sproti zapiše; gumb te vrne na razpored."
                  : "Shrani zapiše sestavo in keglje. TV jih pokaže v paru sekundah.")}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
