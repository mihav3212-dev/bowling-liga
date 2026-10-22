import { useEffect, useMemo, useState } from "react";
import { exportRoundPdfs } from "../lib/exportPdf";
import { inferSeasonKey, officialRoundMeta, seasonCatalog } from "../lib/fixtures";
import { formatMatchWhen } from "../lib/labels";
import { MATCH_SLOT_MS, matchesShowingLive } from "../lib/live";
import { byeTeamName } from "../lib/schedule";
import { matchTotals } from "../lib/scoring";
import { useStore } from "../lib/store";
import type { LeagueState, Match } from "../lib/types";
import { PdfButton } from "./PdfButton";
import { ResultHighlights } from "./ResultHighlights";

/** Najnižje nepopolno kolo / živo / naslednji termin — za skok na razporedu. */
function activeScheduleRound(state: LeagueState, now: number): number | null {
  const { matches, players } = state;
  if (matches.length === 0) return null;
  const incomplete = matches.filter((m) => !matchTotals(m, players).complete);
  const live = matchesShowingLive(incomplete, now);
  if (live[0]) return live[0].round;
  if (incomplete.length === 0) {
    return Math.max(...matches.map((m) => m.round));
  }
  let bestRound: number | null = null;
  let bestStart: number | null = null;
  for (const m of incomplete) {
    if (!m.startsAt) continue;
    const t = new Date(m.startsAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t < now - MATCH_SLOT_MS) continue;
    if (bestStart == null || t < bestStart) {
      bestStart = t;
      bestRound = m.round;
    }
  }
  if (bestRound != null) return bestRound;
  return Math.min(...incomplete.map((m) => m.round));
}

function roundIsComplete(matches: Match[], players: LeagueState["players"]): boolean {
  return matches.length > 0 && matches.every((m) => matchTotals(m, players).complete);
}

export function Matches({
  onOpen,
  canOpen,
  mode,
}: {
  onOpen?: (id: string) => void;
  canOpen?: (match: Match) => boolean;
  mode: "schedule" | "results";
}) {
  const { state } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
  const seasonKey = inferSeasonKey(state);
  const catalog = seasonCatalog(seasonKey);
  const byRound = new Map<number, typeof state.matches>();
  for (const match of state.matches) {
    if (mode === "results" && !matchTotals(match, state.players).complete) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => (mode === "results" ? b - a : a - b));
  const open = state.matches.filter((match) => !matchTotals(match, state.players).complete);
  const live = matchesShowingLive(open, now);
  const activeRound = useMemo(
    () => (mode === "schedule" ? activeScheduleRound(state, now) : null),
    [mode, state, now],
  );

  useEffect(() => {
    if (mode !== "schedule" || activeRound == null) return;
    const id = `schedule-round-${activeRound}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [mode, activeRound]);

  function matchRow(match: Match) {
    const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
    const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
    const totals = matchTotals(match, state.players);
    const row = (
      <>
        {mode === "schedule" && (
          <span className="match-when mono">{formatMatchWhen(match.startsAt)}</span>
        )}
        <span className="match-names">
          {home} – {away}
        </span>
        {mode === "results" && totals.complete && (
          <span className="match-scores mono">
            <span className="score-tocke">
              {totals.homeMatch}:{totals.awayMatch}
            </span>
            <span className="score-velike">
              {totals.homeBig}:{totals.awayBig}
            </span>
            <span>
              {totals.homePins}:{totals.awayPins}
            </span>
          </span>
        )}
      </>
    );
    return onOpen && (!canOpen || canOpen(match)) ? (
      <button
        className="row match-row is-openable"
        type="button"
        key={match.id}
        onClick={() => onOpen(match.id)}
      >
        {row}
        <span className="match-row-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    ) : (
      <div className="row match-row" key={match.id}>
        {row}
      </div>
    );
  }

  return (
    <section>
      {mode === "schedule" && (
        <p className="muted" style={{ marginBottom: 20 }}>
          {catalog.intro}
        </p>
      )}
      {mode === "schedule" && live.length > 0 && (
        <div className="live-now">
          <span className="live-badge">V živo</span>
          <h3 className="round-title">
            {live[0].round}. kolo
            {live[0].startsAt ? ` · ${formatMatchWhen(live[0].startsAt)}` : ""}
          </h3>
          <div className="list">
            {live.map((match) => {
              const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
              const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
              return (
                <button
                  className="row match-row is-openable"
                  key={match.id}
                  type="button"
                  onClick={() => {
                    window.open("/?display=live", "_blank", "noopener,noreferrer");
                  }}
                >
                  <span className="match-when mono">{formatMatchWhen(match.startsAt)}</span>
                  <span className="match-names">
                    {home} – {away}
                  </span>
                  <span className="match-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {mode === "results" && rounds.length > 0 && (
        <p className="muted" style={{ marginBottom: 20 }}>
          Odpri kolo za tekme in najboljše rezultate tistega tedna.
        </p>
      )}
      {rounds.length === 0 && mode === "results" && (
        <p className="muted">Še ni vnesenih rezultatov.</p>
      )}
      {rounds.map((round, index) => {
        const meta = officialRoundMeta(round, seasonKey);
        const bye = meta?.bye ?? byeTeamName(round, state.teams, state.matches);
        const fixtures = [...(byRound.get(round) ?? [])].sort((a, b) =>
          (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
        );
        const heading = `${round}. KOLO${meta?.label || state.roundLabels?.[String(round)] ? ` — ${meta?.label || state.roundLabels?.[String(round)]}` : ""}`;
        const note = state.roundNotes?.[String(round)] || meta?.noteAfter;
        const body = (
          <>
            {bye && <p className="muted">Počiva: {bye}</p>}
            <div className="list" style={{ marginTop: 8 }}>
              {mode === "results" && (
                <div className="row match-row match-score-head">
                  <span className="match-names" />
                  <span className="match-scores">
                    <span>TOČKE</span>
                    <span>
                      Velike
                      <br />
                      točke
                    </span>
                    <span>Keglji</span>
                  </span>
                </div>
              )}
              {fixtures.map((match) => matchRow(match))}
            </div>
            {mode === "results" && (
              <>
                <PdfButton
                  label={`Izvozi PDF-je ${round}. kola`}
                  onExport={() => exportRoundPdfs(state, round)}
                />
                <ResultHighlights scope="round" round={round} state={state} />
              </>
            )}
          </>
        );

        if (mode === "schedule") {
          const past = roundIsComplete(fixtures, state.players);
          const active = activeRound === round;
          if (past) {
            return (
              <details
                key={round}
                id={`schedule-round-${round}`}
                className="round-fold schedule-round-past"
              >
                <summary className="round-title">{heading}</summary>
                {body}
                {note && <p className="season-note">{note}</p>}
              </details>
            );
          }
          return (
            <div
              key={round}
              id={`schedule-round-${round}`}
              className={`schedule-round${active ? " is-active" : ""}`}
            >
              <div className="panel">
                <h3 className="round-title">{heading}</h3>
                {body}
              </div>
              {note && <p className="season-note">{note}</p>}
            </div>
          );
        }

        return (
          <details key={round} className="round-fold" open={index === 0}>
            <summary className="round-title">{heading}</summary>
            {body}
          </details>
        );
      })}
    </section>
  );
}
