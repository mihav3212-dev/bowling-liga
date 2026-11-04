import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { canEnterPins, teamPerms } from "../lib/access";
import { useAuth } from "../lib/auth";
import { exportMatchPdf } from "../lib/exportPdf";
import { playerTag, parsePins, formatMatchWhen } from "../lib/labels";
import { matchEditLockLabel } from "../lib/editLockLabel";
import {
  claimMatchEditLock,
  heartbeatMatchEditLock,
  releaseMatchEditLock,
  releaseMatchEditLockBeacon,
} from "../lib/leagueApi";
import { lineupsRevealed, teamMatchSide } from "../lib/lineup";
import { nominatedIds, pairingTemplate, slotLabel } from "../lib/pairings";
import { lineupLocked, matchPlayerStats, matchTotals, scoreGame, scoredPins } from "../lib/scoring";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";
import type { Player } from "../lib/types";

/** Kot TV: hitro osveževanje, da vsi vidijo isto vpisano. */
const MATCH_SYNC_MS = 800;
const EDIT_LOCK_HEARTBEAT_MS = 20_000;

function newEditLockToken(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function playerName(roster: Player[], id: string): string {
  const player = roster.find((p) => p.id === id);
  return player ? playerTag(player) : "—";
}

/** 0 = manjkajoči igralec; 1–59 = sumljivo nizko — vprašaj za potrditev. */
const LOW_PINS_WARN_BELOW = 60;

function confirmLowPins(pins: number): boolean {
  return window.confirm(
    `Vpisanih je samo ${pins} kegljev (običajno ≥ ${LOW_PINS_WARN_BELOW}).\n\nShranim ta vnos? (Prekliči = ponovni vnos)`,
  );
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
  /** Med tipkanjem držimo niz lokalno — sicer vsaka števka gre v store/bazo in sync lahko odreže npr. 155 → 15. */
  const [draft, setDraft] = useState<string | null>(null);
  const final = scoredPins(raw, player);
  if (readOnly) return <>{final ?? "—"}</>;

  const editing = draft !== null;
  const shown = editing ? draft : raw != null ? String(raw) : "";
  const draftNum = editing ? parsePins(draft) : raw;
  const draftFinal = scoredPins(draftNum, player);
  const showAdj = draftNum != null && draftFinal != null && draftFinal !== draftNum;

  return (
    <span className="pin-entry">
      <input
        className="mono"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        value={shown}
        onFocus={() => {
          setDraft(raw != null ? String(raw) : "");
          onEditingChange?.(true);
        }}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
          setDraft(next);
          // Med tipkanjem še ne opozarjaj — šele ob blur (npr. 5 → 55 → 155).
          onChange(parsePins(next));
        }}
        onBlur={() => {
          const pins = parsePins(draft ?? "");
          const previous = raw;
          setDraft(null);
          onEditingChange?.(false);
          // Če je med tipkanjem že shranjena nizka vrednost, ob preklicu vrni prejšnjo.
          if (pins != null && pins > 0 && pins < LOW_PINS_WARN_BELOW) {
            if (!confirmLowPins(pins)) {
              onChange(previous);
              return;
            }
          }
          if (pins !== raw) onChange(pins);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      {showAdj ? <span className="pin-adj">({draftFinal})</span> : null}
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
    seasonId,
    syncStatus,
    syncMessage,
    setLineup,
    setPins,
    setRoundPlayer,
    setMatchLiveOnTv,
    deleteMatch,
    saveMatchLineupNow,
    saveShownMatch,
    syncFromRemote,
  } = useStore();
  const { admin, teamName } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [lockGate, setLockGate] = useState<"idle" | "checking" | "conflict" | "ready">(
    () => (remote && !readOnly ? "checking" : "ready"),
  );
  const [lockConflictLabel, setLockConflictLabel] = useState<string | null>(null);
  const [forceClaim, setForceClaim] = useState(false);
  const editingPinsRef = useRef(false);
  const editingLineupRef = useRef(false);
  const pinGuardTimer = useRef<number | undefined>(undefined);
  const lockTokenRef = useRef(newEditLockToken());
  const lockActiveRef = useRef(false);
  const syncRef = useRef(syncFromRemote);
  syncRef.current = syncFromRemote;
  const match = state.matches.find((m) => m.id === matchId);
  // Isti admin račun na dveh napravah → različna oznaka (npr. Admin · A3F2).
  const lockLabel = matchEditLockLabel(admin ? "Admin" : teamName?.trim() || "Ekipa");

  const setPinsEditing = (editing: boolean) => {
    if (pinGuardTimer.current != null) {
      window.clearTimeout(pinGuardTimer.current);
      pinGuardTimer.current = undefined;
    }
    if (editing) {
      editingPinsRef.current = true;
      return;
    }
    // Kratko po blur — dovolj, da zadnji save gre ven, TV pa ostane odziven.
    pinGuardTimer.current = window.setTimeout(() => {
      editingPinsRef.current = false;
      pinGuardTimer.current = undefined;
    }, 250);
  };

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
      if (pinGuardTimer.current != null) window.clearTimeout(pinGuardTimer.current);
    };
  }, [remote, matchId]);

  useEffect(() => {
    if (!remote || readOnly) {
      setLockGate("ready");
      return;
    }
    let cancelled = false;
    let heartbeat: number | undefined;
    const token = lockTokenRef.current;
    const season = seasonId ?? undefined;

    const release = () => {
      if (!lockActiveRef.current) return;
      lockActiveRef.current = false;
      releaseMatchEditLockBeacon({ id: season, matchId, token });
    };

    const onPageHide = () => release();

    const holdLock = () => {
      lockActiveRef.current = true;
      setLockGate("ready");
      setLockConflictLabel(null);
      heartbeat = window.setInterval(() => {
        void heartbeatMatchEditLock({
          id: season,
          matchId,
          token,
          label: lockLabel,
        }).then((res) => {
          if (cancelled || res.held !== false) return;
          // Nekdo drug je prevzel — samo opozori, ne zapri vnosa.
          if (res.conflict?.label) setLockConflictLabel(res.conflict.label);
        });
      }, EDIT_LOCK_HEARTBEAT_MS);
    };

    const claim = async () => {
      setLockGate("checking");
      const res = await claimMatchEditLock({
        id: season,
        matchId,
        token,
        label: lockLabel,
        force: forceClaim,
      });
      if (cancelled) return;
      if (!res.ok) {
        // Lokalno / napaka API — ne blokiraj vnosa.
        setLockGate("ready");
        return;
      }
      if (res.held) {
        holdLock();
        return;
      }
      setLockConflictLabel(res.conflict?.label ?? "nekdo drug");
      setLockGate("conflict");
    };

    void claim();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      if (heartbeat != null) window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      if (lockActiveRef.current) {
        lockActiveRef.current = false;
        void releaseMatchEditLock({ id: season, matchId, token });
      }
    };
  }, [remote, readOnly, matchId, seasonId, lockLabel, forceClaim]);

  if (!match) return <p>Tekma ne obstaja.</p>;

  if (lockGate === "checking") {
    return (
      <section>
        <button className="ghost" type="button" onClick={onBack}>
          ← Nazaj
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          Preverjam, ali kdo že vnaša to tekmo…
        </p>
      </section>
    );
  }

  if (lockGate === "conflict") {
    return (
      <section>
        <button className="ghost" type="button" onClick={onBack}>
          ← Nazaj
        </button>
        <div className="dialog-panel" style={{ marginTop: 16, maxWidth: "28rem" }}>
          <h2 style={{ marginTop: 0 }}>Tekmo že vnaša nekdo drug</h2>
          <p>
            Trenutno je odprt vnos pri: <strong>{lockConflictLabel ?? "neznano"}</strong>.
          </p>
          <p className="muted">
            Če odpreš vseeno, lahko oba tipata hkrati in se rezultati prekrivajo. Priporočilo: počakaj
            ali se dogovorita.
          </p>
          <div className="dialog-actions">
            <button className="ghost" type="button" onClick={onBack}>
              Nazaj
            </button>
            <button className="primary" type="button" onClick={() => setForceClaim(true)}>
              Odpri vseeno
            </button>
          </div>
        </div>
      </section>
    );
  }
  const ownSide = teamMatchSide(match, lineupTeamId);
  const viewerTeam = lineupTeamId ? state.teams.find((t) => t.id === lineupTeamId) : undefined;
  const perms = teamPerms(viewerTeam);
  const teamLineup = Boolean(lineupTeamId && ownSide && perms.lineup);
  const canResults = Boolean(lineupTeamId && ownSide && (perms.results || perms.resultsEdit));
  const hideScores = Boolean(lineupTeamId && ownSide && !canResults);
  const pinsReadOnly = readOnly || (Boolean(lineupTeamId) && !canResults);
  /** Admin (ne ekipa): lahko prisili TV prikaz. */
  const canForceTv = !readOnly && !lineupTeamId;

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
            {canForceTv && !totals.complete && (
              <button
                type="button"
                className={`live-tv-force-btn${match.liveOnTv ? " is-on" : ""}`}
                title={
                  match.liveOnTv
                    ? "TV trenutno kaže to tekmo. Klikni za izklop."
                    : "Vklopi, če se tekma začne prej (ali gre čez termin) — TV jo takoj pokaže."
                }
                onClick={() => setMatchLiveOnTv(match.id, !match.liveOnTv)}
              >
                {match.liveOnTv ? "TV: v živo (vklopljeno)" : "TV: v živo"}
              </button>
            )}
            {canForceTv && match.liveOnTv && totals.complete && (
              <p className="muted" style={{ marginTop: 8 }}>
                Tekma je končana — TV force se ugasne sam.
              </p>
            )}
            {remote && !readOnly && syncStatus !== "idle" && (
              <p
                className={syncStatus === "error" ? "save-sync is-error" : "save-sync"}
                style={{ marginTop: 8, marginBottom: 0 }}
                aria-live="polite"
              >
                {syncStatus === "saving"
                  ? "Shranjujem…"
                  : syncStatus === "saved"
                    ? "Shranjeno"
                    : syncMessage || "Ni shranjeno — preveri povezavo"}
              </p>
            )}
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
                        onEditingChange={setPinsEditing}
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
                        onEditingChange={setPinsEditing}
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
        {canForceTv && (
          <button
            className="ghost"
            type="button"
            title="Odstrani to tekmo iz razporeda (npr. ekipa ni igrala)."
            onClick={() => {
              const hasPins = match.rounds.some((r) =>
                r.games.some((g) => g.homePins != null || g.awayPins != null),
              );
              const warn = hasPins || totals.complete ? " Ima že rezultate." : "";
              if (
                !window.confirm(
                  `Res zbrišem tekmo ${home?.name ?? "?"} — ${away?.name ?? "?"} (${match.round}. kolo)?${warn}`,
                )
              ) {
                return;
              }
              deleteMatch(match.id);
              onBack();
            }}
          >
            Izbriši tekmo
          </button>
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
            <span
              className={
                syncStatus === "error" || saveNote
                  ? "save-sync is-error"
                  : syncStatus === "saving" || syncStatus === "saved"
                    ? "save-sync"
                    : "muted"
              }
              aria-live="polite"
            >
              {saveNote ||
                (remote && syncStatus === "saving"
                  ? "Shranjujem…"
                  : remote && syncStatus === "saved"
                    ? "Shranjeno"
                    : remote && syncStatus === "error"
                      ? syncMessage ||
                        "Ni shranjeno — preveri povezavo (poskusil bom znova ob naslednjem vnosu)."
                      : teamLineup
                        ? "Sestava se sproti zapiše; gumb te vrne na razpored."
                        : "Shrani zapiše sestavo in keglje. TV jih pokaže v paru sekundah.")}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
