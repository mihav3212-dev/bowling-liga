import type { LiveMatchView } from "../lib/liveBoard";

/** Predogled vertikalnega pregleda končane tekme (zavihek Rezultati). */

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
      homePins: 312,
      awayPins: 278,
      duels: [
        { lane: 1, homeName: "M. Novak", awayName: "P. Zupan", homePins: 187, awayPins: 162 },
        { lane: 2, homeName: "J. Horvat", awayName: "L. Vidmar", homePins: 201, awayPins: 178 },
        { lane: 3, homeName: "T. Kralj", awayName: "M. Hribar", homePins: 168, awayPins: 155 },
        { lane: 4, homeName: "S. Breznik", awayName: "A. Kovač", homePins: 156, awayPins: 183 },
      ],
    },
    {
      round: 2,
      homeSmall: 6,
      awaySmall: 4,
      homePins: 300,
      awayPins: 270,
      duels: [
        { lane: 1, homeName: "T. Kralj", awayName: "A. Kovač", homePins: 172, awayPins: 160 },
        { lane: 2, homeName: "S. Breznik", awayName: "M. Hribar", homePins: 145, awayPins: 158 },
        { lane: 3, homeName: "M. Novak", awayName: "L. Vidmar", homePins: 190, awayPins: 171 },
        { lane: 4, homeName: "J. Horvat", awayName: "P. Zupan", homePins: 193, awayPins: 181 },
      ],
    },
    {
      round: 3,
      homeSmall: 7,
      awaySmall: 5,
      homePins: 293,
      awayPins: 269,
      duels: [
        { lane: 1, homeName: "J. Horvat", awayName: "M. Hribar", homePins: 178, awayPins: 166 },
        { lane: 2, homeName: "M. Novak", awayName: "A. Kovač", homePins: 185, awayPins: 149 },
        { lane: 3, homeName: "S. Breznik", awayName: "P. Zupan", homePins: 152, awayPins: 170 },
        { lane: 4, homeName: "T. Kralj", awayName: "L. Vidmar", homePins: 178, awayPins: 184 },
      ],
    },
    {
      round: 4,
      homeSmall: 7,
      awaySmall: 3,
      homePins: 343,
      awayPins: 279,
      duels: [
        { lane: 1, homeName: "S. Breznik", awayName: "L. Vidmar", homePins: 178, awayPins: 165 },
        { lane: 2, homeName: "T. Kralj", awayName: "M. Hribar", homePins: 192, awayPins: 171 },
        { lane: 3, homeName: "J. Horvat", awayName: "A. Kovač", homePins: 168, awayPins: 184 },
        { lane: 4, homeName: "M. Novak", awayName: "P. Zupan", homePins: 205, awayPins: 159 },
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

type Props = {
  view?: LiveMatchView;
  preview?: boolean;
  onBack?: () => void;
};

export function MatchResultView({ view = PREVIEW, preview = false, onBack }: Props) {
  const m = view;
  const homeWins = (m.homeMatch ?? 0) > (m.awayMatch ?? 0);
  const awayWins = (m.awayMatch ?? 0) > (m.homeMatch ?? 0);

  return (
    <div className="result-view">
      <div className="result-view-glow" aria-hidden />

      {(onBack || preview) && (
        <div className="result-view-toolbar">
          {onBack ? (
            <button type="button" className="ghost result-view-back" onClick={onBack}>
              ← Nazaj na rezultate
            </button>
          ) : (
            <span className="result-view-preview-tag">Predogled · zavihek Rezultati</span>
          )}
          {preview && (
            <span className="result-view-preview-note">
              <code>?display=result-preview</code> · samo ogled, brez urejanja
            </span>
          )}
        </div>
      )}

      <header className="result-view-top">
        <div className="result-view-brand">
          <img src="/logo-bowling-lenart.png" alt="" className="result-view-logo" />
          <div>
            <div className="result-view-brand-name">Bowling Lenart</div>
            <div className="result-view-brand-sub">Liga · {m.round}. kolo</div>
          </div>
        </div>
        <div className="result-view-meta">
          <span className="result-view-final-mark" aria-hidden />
          <span className="result-view-final">Končano</span>
          <span className="result-view-when">{m.startsAtLabel}</span>
        </div>
      </header>

      <section className="result-view-scoreboard">
        <div className={`result-view-side is-home${homeWins ? " is-winner" : ""}`}>
          <div className="result-view-side-label">{homeWins ? "Zmaga" : "Domači"}</div>
          <h1 className="result-view-team">{m.homeName}</h1>
        </div>

        <div className="result-view-center">
          <div className="result-view-score-label">KONČNI REZULTAT</div>
          <div className="result-view-score">
            <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
            <span className="result-view-score-sep">:</span>
            <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
          </div>
          <div className="result-view-stats-featured">
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Velike točke</span>
              <strong>
                {m.homeBig}:{m.awayBig}
              </strong>
            </div>
            <div className="result-view-stat-block">
              <span className="result-view-stat-label">Keglji</span>
              <strong>
                {m.homePins}:{m.awayPins}
              </strong>
            </div>
          </div>
          <div className="result-view-stats-minor">
            Male točke <strong>{m.homeSmall}:{m.awaySmall}</strong>
          </div>
        </div>

        <div className={`result-view-side is-away${awayWins ? " is-winner" : ""}`}>
          <div className="result-view-side-label">{awayWins ? "Zmaga" : "Gostje"}</div>
          <h1 className="result-view-team">{m.awayName}</h1>
        </div>
      </section>

      <section className="result-view-rounds">
        <h2 className="result-view-rounds-title">Po krogih</h2>
        <div className="result-view-rounds-stack">
          {m.roundSummaries.map((r) => {
            const lead =
              r.homeSmall == null || r.awaySmall == null
                ? "open"
                : r.homeSmall === r.awaySmall
                  ? "tie"
                  : r.homeSmall > r.awaySmall
                    ? "home"
                    : "away";
            return (
              <article key={r.round} className="result-view-round">
                <div className="result-view-round-head">
                  <div className="result-view-round-num">{r.round}. krog</div>
                  <div className="result-view-round-score">
                    <span className={lead === "home" ? "is-lead" : undefined}>
                      {r.homeSmall ?? "·"}
                    </span>
                    <span className="result-view-score-sep">:</span>
                    <span className={lead === "away" ? "is-lead" : undefined}>
                      {r.awaySmall ?? "·"}
                    </span>
                  </div>
                  <div className="result-view-round-pins">
                    {r.homePins ?? "—"}:{r.awayPins ?? "—"} kegljev
                  </div>
                </div>
                <div className="result-view-duels">
                  {r.duels.map((d) => {
                    const dLead = duelLead(d.homePins, d.awayPins);
                    return (
                      <div key={d.lane} className="result-view-duel">
                        <span className="result-view-lane">Steza {d.lane}</span>
                        <span className={`result-view-duel-name is-home${dLead === "home" ? " is-lead" : ""}`}>
                          {d.homeName}
                        </span>
                        <span className={`result-view-duel-pins is-home${dLead === "home" ? " is-lead" : ""}`}>
                          {pinsLabel(d.homePins)}
                        </span>
                        <span className="result-view-duel-sep">–</span>
                        <span className={`result-view-duel-pins is-away${dLead === "away" ? " is-lead" : ""}`}>
                          {pinsLabel(d.awayPins)}
                        </span>
                        <span className={`result-view-duel-name is-away${dLead === "away" ? " is-lead" : ""}`}>
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
    </div>
  );
}
