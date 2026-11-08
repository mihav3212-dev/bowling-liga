import { Fragment, useEffect, useRef } from "react";
import { FitTeamName } from "../components/FitTeamName";
import type { LiveMatchView } from "../lib/liveBoard";
import type { MatchPlayerStat } from "../lib/scoring";
import { exportMatchPdf } from "../lib/exportPdf";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";

/** Predogled / ogled končane tekme (zavihek Rezultati). */

const PREVIEW: LiveMatchView = {
  complete: true,
  round: 3,
  homeName: "Vardam",
  awayName: "Parma",
  homeMatch: 2,
  awayMatch: 0,
  homeBig: 10,
  awayBig: 2,
  homeSmall: 28,
  awaySmall: 16,
  homePins: 1248,
  awayPins: 1096,
  startsAtLabel: "TOR 13. 10. 19:00",
  roundSummaries: [
    {
      round: 1,
      homeSmall: 8,
      awaySmall: 4,
      homeBig: 2,
      awayBig: 0,
      homePins: 312,
      awayPins: 278,
      duels: [
        { lane: 1, homeName: "M. Novak", awayName: "P. Zupan", homePins: 187, awayPins: 162, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "J. Horvat", awayName: "L. Vidmar", homePins: 201, awayPins: 178, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "T. Kralj", awayName: "M. Hribar", homePins: 168, awayPins: 155, homeSmall: 2, awaySmall: 0 },
        { lane: 4, homeName: "S. Breznik", awayName: "A. Kovač", homePins: 156, awayPins: 183, homeSmall: 0, awaySmall: 2 },
      ],
    },
    {
      round: 2,
      homeSmall: 6,
      awaySmall: 4,
      homeBig: 2,
      awayBig: 0,
      homePins: 300,
      awayPins: 270,
      duels: [
        { lane: 1, homeName: "T. Kralj", awayName: "A. Kovač", homePins: 172, awayPins: 160, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "S. Breznik", awayName: "M. Hribar", homePins: 145, awayPins: 158, homeSmall: 0, awaySmall: 2 },
        { lane: 3, homeName: "M. Novak", awayName: "L. Vidmar", homePins: 190, awayPins: 171, homeSmall: 2, awaySmall: 0 },
        { lane: 4, homeName: "J. Horvat", awayName: "P. Zupan", homePins: 193, awayPins: 181, homeSmall: 2, awaySmall: 0 },
      ],
    },
    {
      round: 3,
      homeSmall: 7,
      awaySmall: 5,
      homeBig: 2,
      awayBig: 0,
      homePins: 293,
      awayPins: 269,
      duels: [
        { lane: 1, homeName: "J. Horvat", awayName: "M. Hribar", homePins: 178, awayPins: 166, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "M. Novak", awayName: "A. Kovač", homePins: 185, awayPins: 149, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "S. Breznik", awayName: "P. Zupan", homePins: 152, awayPins: 170, homeSmall: 0, awaySmall: 2 },
        { lane: 4, homeName: "T. Kralj", awayName: "L. Vidmar", homePins: 178, awayPins: 184, homeSmall: 0, awaySmall: 2 },
      ],
    },
    {
      round: 4,
      homeSmall: 7,
      awaySmall: 3,
      homeBig: 2,
      awayBig: 0,
      homePins: 343,
      awayPins: 279,
      duels: [
        { lane: 1, homeName: "S. Breznik", awayName: "L. Vidmar", homePins: 178, awayPins: 165, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "T. Kralj", awayName: "M. Hribar", homePins: 192, awayPins: 171, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "J. Horvat", awayName: "A. Kovač", homePins: 168, awayPins: 184, homeSmall: 0, awaySmall: 2 },
        { lane: 4, homeName: "M. Novak", awayName: "P. Zupan", homePins: 205, awayPins: 159, homeSmall: 2, awaySmall: 0 },
      ],
    },
  ],
};

function pinsLabel(n: number | null) {
  return n == null ? "—" : String(n);
}

function duelLead(home: number | null, away: number | null): "home" | "away" | "tie" | "open" {
  if (home == null || away == null) return "open";
  if (home > away) return "home";
  if (away > home) return "away";
  return "tie";
}

function fmtAvg(n: number | null) {
  return n != null
    ? n.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

type Props = {
  view?: LiveMatchView;
  preview?: boolean;
  onBack?: () => void;
  backLabel?: string;
  onEdit?: () => void;
  playerStats?: MatchPlayerStat[];
  matchId?: string;
};

export function MatchResultView({
  view = PREVIEW,
  preview = false,
  onBack,
  backLabel = "← Nazaj",
  onEdit,
  playerStats = [],
  matchId,
}: Props) {
  const { state } = useStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const m = view;
  const homeWins = m.complete && (m.homeMatch ?? 0) > (m.awayMatch ?? 0);
  const awayWins = m.complete && (m.awayMatch ?? 0) > (m.homeMatch ?? 0);
  const tied = m.complete && (m.homeMatch ?? 0) === (m.awayMatch ?? 0);
  /** Neon stil krogov tudi med tekmo (ogled iz razporeda). */
  const neonRounds = true;

  useEffect(() => {
    if (preview) return;
    const el = rootRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [preview, matchId, m.homeName, m.awayName, m.startsAtLabel]);

  return (
    <div className={`result-view${neonRounds ? " is-neon" : ""}`} ref={rootRef}>
      <div className="result-view-glow" aria-hidden />

      {(onBack || preview || onEdit) && (
        <div className="result-view-toolbar">
          {onBack ? (
            <button type="button" className="ghost result-view-back" onClick={onBack}>
              {backLabel}
            </button>
          ) : preview ? (
            <span className="result-view-preview-tag">Predogled · zavihek Rezultati</span>
          ) : (
            <span className="result-view-toolbar-spacer" />
          )}
          <div className="result-view-toolbar-actions">
            {preview && (
              <span className="result-view-preview-note">
                <code>?display=result-preview</code>
              </span>
            )}
            {matchId && !preview && (
              <PdfButton label="PDF" onExport={() => exportMatchPdf(state, matchId)} />
            )}
            {onEdit && (
              <button type="button" className="primary result-view-edit" onClick={onEdit}>
                Popravi
              </button>
            )}
          </div>
        </div>
      )}

      <header className="result-view-top">
        <div className="result-view-kolo">Liga · {m.round}. kolo</div>
        <div className="result-view-when">{m.startsAtLabel}</div>
        {!m.complete && <div className="result-view-final">V teku</div>}
      </header>

      <section className="result-view-scoreboard">
        <div className={`result-view-side is-home${homeWins ? " is-winner" : ""}`}>
          <div className="result-view-side-label">
            {homeWins ? "Zmagovalci" : awayWins ? "Poraženci" : tied ? "Neodločeno" : "Domači"}
          </div>
          <div className={`result-view-name-row${homeWins ? " is-winner" : ""}`}>
            <FitTeamName
              name={m.homeName}
              className="result-view-team"
              wordClassName="result-view-team-word"
              neonLetters={homeWins}
              neonTone="cyan"
              maxFontPx={78}
              widthFactor={0.48}
              fitGroup={`result-${matchId}`}
              sizeScale={homeWins ? 1.14 : 1}
            />
          </div>
        </div>

        <div className="result-view-center">
          <div className="result-view-score-label is-neon-final">Končne točke</div>
          <div className="result-view-score is-neon-final">
            <span className={`neon-digit is-neon-cyan${homeWins ? " is-winner" : ""}`}>
              {m.homeMatch ?? "·"}
            </span>
            <span className="result-view-score-sep is-neon-final">:</span>
            <span className={`neon-digit is-neon-magenta${awayWins ? " is-winner" : ""}`}>
              {m.awayMatch ?? "·"}
            </span>
          </div>
          <div className="result-view-stats-featured is-neon-pair">
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Velike</span>
              <strong>
                <span
                  className={`is-neon-cyan${(m.homeBig ?? 0) > (m.awayBig ?? 0) ? " is-lead" : ""}`}
                >
                  {m.homeBig ?? "·"}
                </span>
                <span className="result-view-score-sep">:</span>
                <span
                  className={`is-neon-magenta${(m.awayBig ?? 0) > (m.homeBig ?? 0) ? " is-lead" : ""}`}
                >
                  {m.awayBig ?? "·"}
                </span>
              </strong>
            </div>
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Male</span>
              <strong>
                <span
                  className={`is-neon-cyan${(m.homeSmall ?? 0) > (m.awaySmall ?? 0) ? " is-lead" : ""}`}
                >
                  {m.homeSmall ?? "·"}
                </span>
                <span className="result-view-score-sep">:</span>
                <span
                  className={`is-neon-magenta${(m.awaySmall ?? 0) > (m.homeSmall ?? 0) ? " is-lead" : ""}`}
                >
                  {m.awaySmall ?? "·"}
                </span>
              </strong>
            </div>
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Keglji</span>
              <strong>
                <span
                  className={`is-neon-cyan${(m.homePins ?? 0) > (m.awayPins ?? 0) ? " is-lead" : ""}`}
                >
                  {m.homePins ?? "·"}
                </span>
                <span className="result-view-score-sep">:</span>
                <span
                  className={`is-neon-magenta${(m.awayPins ?? 0) > (m.homePins ?? 0) ? " is-lead" : ""}`}
                >
                  {m.awayPins ?? "·"}
                </span>
              </strong>
            </div>
          </div>
        </div>

        <div className={`result-view-side is-away${awayWins ? " is-winner" : ""}`}>
          <div className="result-view-side-label">
            {awayWins ? "Zmagovalci" : homeWins ? "Poraženci" : tied ? "Neodločeno" : "Gostje"}
          </div>
          <div className={`result-view-name-row is-away${awayWins ? " is-winner" : ""}`}>
            <FitTeamName
              name={m.awayName}
              className="result-view-team"
              wordClassName="result-view-team-word"
              neonLetters={awayWins}
              neonTone="magenta"
              maxFontPx={78}
              widthFactor={0.48}
              fitGroup={`result-${matchId}`}
              sizeScale={awayWins ? 1.14 : 1}
            />
          </div>
        </div>
      </section>

      <section className="result-view-rounds">
        <h2 className="result-view-rounds-title">Po krogih</h2>
        <div className="result-view-rounds-stack">
          {m.roundSummaries.map((r) => {
            const smallLead =
              r.homeSmall == null || r.awaySmall == null
                ? "open"
                : r.homeSmall === r.awaySmall
                  ? "tie"
                  : r.homeSmall > r.awaySmall
                    ? "home"
                    : "away";
            const bigLead =
              r.homeBig == null || r.awayBig == null
                ? "open"
                : r.homeBig === r.awayBig
                  ? "tie"
                  : r.homeBig > r.awayBig
                    ? "home"
                    : "away";
            const pinsLead =
              r.homePins == null || r.awayPins == null
                ? "open"
                : r.homePins === r.awayPins
                  ? "tie"
                  : r.homePins > r.awayPins
                    ? "home"
                    : "away";
            return (
              <article
                key={r.round}
                className={`result-view-round${neonRounds ? " is-neon" : ""}`}
              >
                <div className="result-view-round-num">{r.round}. krog</div>
                <dl className="result-view-round-stats">
                  <div className="result-view-round-stat">
                    <dt>Male točke</dt>
                    <dd className={neonRounds ? "is-neon-pair" : undefined}>
                      <span
                        className={`is-neon-cyan${smallLead === "home" ? " is-lead" : ""}`}
                      >
                        {r.homeSmall ?? "·"}
                      </span>
                      <span className="result-view-score-sep">:</span>
                      <span
                        className={`is-neon-magenta${smallLead === "away" ? " is-lead" : ""}`}
                      >
                        {r.awaySmall ?? "·"}
                      </span>
                    </dd>
                  </div>
                  <div className="result-view-round-stat">
                    <dt>Velike točke</dt>
                    <dd className={neonRounds ? "is-neon-pair" : undefined}>
                      {r.homeBig != null && r.awayBig != null ? (
                        <>
                          <span
                            className={`is-neon-cyan${bigLead === "home" ? " is-lead" : ""}`}
                          >
                            {r.homeBig}
                          </span>
                          <span className="result-view-score-sep">:</span>
                          <span
                            className={`is-neon-magenta${bigLead === "away" ? " is-lead" : ""}`}
                          >
                            {r.awayBig}
                          </span>
                        </>
                      ) : (
                        "·:·"
                      )}
                    </dd>
                  </div>
                  <div className="result-view-round-stat">
                    <dt>Keglji</dt>
                    <dd className={neonRounds ? "is-neon-pair" : undefined}>
                      {r.homePins != null && r.awayPins != null ? (
                        <>
                          <span
                            className={`is-neon-cyan${pinsLead === "home" ? " is-lead" : ""}`}
                          >
                            {r.homePins}
                          </span>
                          <span className="result-view-score-sep">:</span>
                          <span
                            className={`is-neon-magenta${pinsLead === "away" ? " is-lead" : ""}`}
                          >
                            {r.awayPins}
                          </span>
                        </>
                      ) : (
                        "—:—"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="result-view-duels">
                  {r.duels.map((d) => {
                    const dLead = duelLead(d.homePins, d.awayPins);
                    const small =
                      d.homeSmall != null && d.awaySmall != null
                        ? `(${d.homeSmall}:${d.awaySmall})`
                        : null;
                    return (
                      <div
                        key={d.lane}
                        className={`result-view-duel${neonRounds ? " is-neon" : ""}`}
                      >
                        <span className="result-view-lane">S{d.lane}</span>
                        <span
                          className={`result-view-duel-name is-home${dLead === "home" ? " is-lead" : ""}`}
                        >
                          {d.homeName}
                        </span>
                        <span
                          className={`result-view-duel-pins is-home is-neon-cyan${dLead === "home" ? " is-lead" : ""}`}
                        >
                          {pinsLabel(d.homePins)}
                        </span>
                        <span className="result-view-duel-mid">
                          {small ? (
                            <span className="result-view-duel-small">{small}</span>
                          ) : (
                            <span className="result-view-duel-sep">–</span>
                          )}
                        </span>
                        <span
                          className={`result-view-duel-pins is-away is-neon-magenta${dLead === "away" ? " is-lead" : ""}`}
                        >
                          {pinsLabel(d.awayPins)}
                        </span>
                        <span
                          className={`result-view-duel-name is-away${dLead === "away" ? " is-lead" : ""}`}
                        >
                          {d.awayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {playerStats.length > 0 && (
        <section className="result-view-players">
          <h2 className="result-view-rounds-title">Po igralcih</h2>
          <div className="result-view-players-table-wrap">
            <table className="result-view-players-table">
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
                    { side: "home" as const, label: m.homeName },
                    { side: "away" as const, label: m.awayName },
                  ] as const
                ).map((group) => {
                  const rows = playerStats.filter((r) => r.side === group.side);
                  if (!rows.length) return null;
                  return (
                    <Fragment key={group.side}>
                      <tr className="result-view-player-team">
                        <td colSpan={4}>{group.label}</td>
                      </tr>
                      {rows.map((row) => (
                        <tr key={`${row.side}-${row.playerId}`}>
                          <td>{row.name}</td>
                          <td className="mono">{row.small}</td>
                          <td className="mono">{row.pins}</td>
                          <td className="mono">{fmtAvg(row.average)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
