import { Fragment, useLayoutEffect, useRef } from "react";
import type { LiveMatchView } from "../lib/liveBoard";
import type { MatchPlayerStat } from "../lib/scoring";
import { exportMatchPdf } from "../lib/exportPdf";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";

/** Vsaka beseda v svoji vrstici; velikost se prilagodi najdaljši besedi (brez lomljenja sredi besede). */
function FitTeamName({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = name.trim().split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;

    const fit = () => {
      const maxPx = Math.min(52, Math.max(20, box.clientWidth * 0.28));
      const minPx = 12;
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      while (size > minPx && el.scrollWidth > box.clientWidth + 1) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [name]);

  return (
    <h1 ref={ref} className={className}>
      {words.map((word, i) => (
        <Fragment key={`${i}-${word}`}>
          {i > 0 ? <br /> : null}
          <span className="result-view-team-word">{word}</span>
        </Fragment>
      ))}
    </h1>
  );
}

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
  onEdit?: () => void;
  playerStats?: MatchPlayerStat[];
  matchId?: string;
};

export function MatchResultView({
  view = PREVIEW,
  preview = false,
  onBack,
  onEdit,
  playerStats = [],
  matchId,
}: Props) {
  const { state } = useStore();
  const m = view;
  const homeWins = (m.homeMatch ?? 0) > (m.awayMatch ?? 0);
  const awayWins = (m.awayMatch ?? 0) > (m.homeMatch ?? 0);
  const tied = m.complete && (m.homeMatch ?? 0) === (m.awayMatch ?? 0);

  return (
    <div className="result-view">
      <div className="result-view-glow" aria-hidden />

      {(onBack || preview || onEdit) && (
        <div className="result-view-toolbar">
          {onBack ? (
            <button type="button" className="ghost result-view-back" onClick={onBack}>
              ← Nazaj na rezultate
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
            {homeWins ? "Zmaga" : tied ? "Neodločeno" : "Domači"}
          </div>
          <FitTeamName name={m.homeName} className="result-view-team" />
        </div>

        <div className="result-view-center">
          <div className="result-view-score-label">Končne točke</div>
          <div className="result-view-score">
            <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
            <span className="result-view-score-sep">:</span>
            <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
          </div>
          <div className="result-view-stats-featured">
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Velike</span>
              <strong>
                {m.homeBig}:{m.awayBig}
              </strong>
            </div>
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Male</span>
              <strong>
                {m.homeSmall}:{m.awaySmall}
              </strong>
            </div>
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Keglji</span>
              <strong>
                {m.homePins}:{m.awayPins}
              </strong>
            </div>
          </div>
        </div>

        <div className={`result-view-side is-away${awayWins ? " is-winner" : ""}`}>
          <div className="result-view-side-label">
            {awayWins ? "Zmaga" : tied ? "Neodločeno" : "Gostje"}
          </div>
          <FitTeamName name={m.awayName} className="result-view-team" />
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
            return (
              <article key={r.round} className="result-view-round">
                <div className="result-view-round-num">{r.round}. krog</div>
                <dl className="result-view-round-stats">
                  <div className="result-view-round-stat">
                    <dt>Male točke</dt>
                    <dd>
                      <span className={smallLead === "home" ? "is-lead" : undefined}>
                        {r.homeSmall ?? "·"}
                      </span>
                      <span className="result-view-score-sep">:</span>
                      <span className={smallLead === "away" ? "is-lead" : undefined}>
                        {r.awaySmall ?? "·"}
                      </span>
                    </dd>
                  </div>
                  <div className="result-view-round-stat">
                    <dt>Velike točke</dt>
                    <dd>
                      {r.homeBig != null && r.awayBig != null ? (
                        <>
                          {r.homeBig}:{r.awayBig}
                        </>
                      ) : (
                        "·:·"
                      )}
                    </dd>
                  </div>
                  <div className="result-view-round-stat">
                    <dt>Keglji</dt>
                    <dd>
                      {r.homePins != null && r.awayPins != null
                        ? `${r.homePins}:${r.awayPins}`
                        : "—:—"}
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
                      <div key={d.lane} className="result-view-duel">
                        <span className="result-view-lane">S{d.lane}</span>
                        <span
                          className={`result-view-duel-name is-home${dLead === "home" ? " is-lead" : ""}`}
                        >
                          {d.homeName}
                        </span>
                        <span
                          className={`result-view-duel-pins is-home${dLead === "home" ? " is-lead" : ""}`}
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
                          className={`result-view-duel-pins is-away${dLead === "away" ? " is-lead" : ""}`}
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
