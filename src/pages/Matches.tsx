import { useEffect, useState } from "react";
import { exportRoundPdfs } from "../lib/exportPdf";
import { inferSeasonKey, officialRoundMeta, seasonCatalog } from "../lib/fixtures";
import { formatMatchWhen } from "../lib/labels";
import { matchesInPlay } from "../lib/live";
import { byeTeamName } from "../lib/schedule";
import { matchTotals } from "../lib/scoring";
import { useStore } from "../lib/store";
import type { Match } from "../lib/types";
import { PdfButton } from "./PdfButton";
import { RescheduleMatchDialog } from "./RescheduleMatchDialog";
import { ResultHighlights } from "./ResultHighlights";

export function Matches({
  onOpen,
  canOpen,
  mode,
  canReschedule = false,
}: {
  onOpen?: (id: string) => void;
  canOpen?: (match: Match) => boolean;
  mode: "schedule" | "results";
  /** Admin: sprememba datuma/ure na razporedu. */
  canReschedule?: boolean;
}) {
  const { state } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
  const seasonKey = inferSeasonKey(state);
  const rescheduleMatch = rescheduleId
    ? state.matches.find((m) => m.id === rescheduleId) ?? null
    : null;
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
  const live = matchesInPlay(open, now);

  function matchRow(match: Match) {
    const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
    const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
    const totals = matchTotals(match, state.players);
    const when = formatMatchWhen(match.startsAt) || "Brez termina";
    const row = (
      <>
        {mode === "schedule" &&
          (canReschedule ? (
            <button
              type="button"
              className="ghost match-when-btn mono"
              title="Spremeni termin"
              onClick={(e) => {
                e.stopPropagation();
                setRescheduleId(match.id);
              }}
            >
              {when}
            </button>
          ) : (
            <span className="match-when mono">{when === "Brez termina" ? "" : when}</span>
          ))}
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
    const openable = Boolean(onOpen && (!canOpen || canOpen(match)));

    // Ločena vrstica, da gumb za termin ni znotraj gumba za odpiranje tekme.
    if (mode === "schedule" && canReschedule) {
      return (
        <div className="row match-row match-row-split" key={match.id}>
          <button
            type="button"
            className="ghost match-when-btn mono"
            title="Spremeni termin"
            onClick={() => setRescheduleId(match.id)}
          >
            {when}
          </button>
          {openable ? (
            <button
              type="button"
              className="match-row-open"
              onClick={() => onOpen?.(match.id)}
            >
              <span className="match-names">
                {home} – {away}
              </span>
            </button>
          ) : (
            <span className="match-names">
              {home} – {away}
            </span>
          )}
        </div>
      );
    }

    return openable ? (
      <button className="row match-row" key={match.id} onClick={() => onOpen!(match.id)}>
        {row}
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
          {canReschedule
            ? " Termin spremeniš s klikom na datum/uro (ko se ekipi dogovorita)."
            : ""}
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
                  className="row match-row"
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
          return (
            <div key={round}>
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
      {rescheduleMatch && (
        <RescheduleMatchDialog match={rescheduleMatch} onClose={() => setRescheduleId(null)} />
      )}
    </section>
  );
}
