import { useEffect, useRef, useState, type RefObject } from "react";
import { fetchLeague } from "../lib/leagueApi";
import {
  buildLiveMatchView,
  pickLiveBoardMatch,
  type LiveMatchView,
} from "../lib/liveBoard";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

function useLiveFullscreen(rootRef: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      setActive(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [rootRef]);

  const toggle = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Brskalnik ali politika lahko zavrne fullscreen.
    }
  };

  return { active, toggle };
}

function LiveFullscreenButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`live-tv-fs-btn${active ? " is-on" : ""}`}
      onClick={() => void onToggle()}
      title={active ? "Izhod iz celozaslonskega (Esc)" : "Celozaslonski prikaz"}
    >
      {active ? "Zapri cel zaslon" : "Cel zaslon"}
    </button>
  );
}

type DuelRow = LiveMatchView["roundSummaries"][number]["duels"][number];

function pinsLabel(n: number | null) {
  return n == null ? "—" : String(n);
}

function pairLabel(home: number | null, away: number | null) {
  if (home == null && away == null) return "—";
  return `${pinsLabel(home)}:${pinsLabel(away)}`;
}

function duelLead(home: number | null, away: number | null): "home" | "away" | "tie" | "open" {
  if (home == null || away == null) return "open";
  if (home > away) return "home";
  if (away > home) return "away";
  return "tie";
}

const emptyDuels = (names: [string, string][]): DuelRow[] =>
  names.map(([homeName, awayName], i) => ({
    lane: i + 1,
    homeName,
    awayName,
    homePins: null,
    awayPins: null,
  }));

const LINEUPS: [string, string][][] = [
  [
    ["M. Novak", "P. Zupan"],
    ["J. Horvat", "L. Vidmar"],
    ["T. Kralj", "M. Hribar"],
    ["S. Breznik", "A. Kovač"],
  ],
  [
    ["T. Kralj", "A. Kovač"],
    ["S. Breznik", "M. Hribar"],
    ["M. Novak", "L. Vidmar"],
    ["J. Horvat", "P. Zupan"],
  ],
  [
    ["J. Horvat", "M. Hribar"],
    ["M. Novak", "A. Kovač"],
    ["S. Breznik", "P. Zupan"],
    ["T. Kralj", "L. Vidmar"],
  ],
  [
    ["S. Breznik", "L. Vidmar"],
    ["T. Kralj", "M. Hribar"],
    ["J. Horvat", "A. Kovač"],
    ["M. Novak", "P. Zupan"],
  ],
];

/** Med tekmo: 1. krog končan, 2. delno, 3–4 še prazna. */
const PREVIEW_LIVE: LiveMatchView = {
  complete: false,
  round: 3,
  homeName: "Vardam",
  awayName: "Parma",
  homeMatch: null,
  awayMatch: null,
  homeBig: 4,
  awayBig: 2,
  homeSmall: 14,
  awaySmall: 8,
  homePins: 612,
  awayPins: 548,
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
      homeBig: null,
      awayBig: null,
      homePins: 300,
      awayPins: 270,
      duels: [
        { lane: 1, homeName: "T. Kralj", awayName: "A. Kovač", homePins: 172, awayPins: 160 },
        { lane: 2, homeName: "S. Breznik", awayName: "M. Hribar", homePins: 145, awayPins: 158 },
        { lane: 3, homeName: "M. Novak", awayName: "L. Vidmar", homePins: 190, awayPins: null },
        { lane: 4, homeName: "J. Horvat", awayName: "P. Zupan", homePins: null, awayPins: null },
      ],
    },
    {
      round: 3,
      homeSmall: null,
      awaySmall: null,
      homeBig: null,
      awayBig: null,
      homePins: null,
      awayPins: null,
      duels: emptyDuels(LINEUPS[2]!),
    },
    {
      round: 4,
      homeSmall: null,
      awaySmall: null,
      homeBig: null,
      awayBig: null,
      homePins: null,
      awayPins: null,
      duels: emptyDuels(LINEUPS[3]!),
    },
  ],
};

const PREVIEW_FINAL: LiveMatchView = {
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
      homeBig: 2,
      awayBig: 0,
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
      homeBig: 2,
      awayBig: 0,
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
      homeBig: 2,
      awayBig: 0,
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

const POLL_MS = 8_000;

export type LiveTvLayout = "classic" | "quad";

const LAYOUT_KEY = "liga-tv-layout";

function readLiveLayout(): LiveTvLayout {
  const q = new URLSearchParams(window.location.search).get("layout");
  if (q === "quad" || q === "classic") return q;
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored === "quad" || stored === "classic") return stored;
  } catch {
    /* ignore */
  }
  return "classic";
}

function writeLiveLayout(next: LiveTvLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, next);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  if (next === "quad") url.searchParams.set("layout", "quad");
  else url.searchParams.delete("layout");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function useLiveLayout(): [LiveTvLayout, (next: LiveTvLayout) => void] {
  const [layout, setLayoutState] = useState<LiveTvLayout>(() => readLiveLayout());
  const setLayout = (next: LiveTvLayout) => {
    setLayoutState(next);
    writeLiveLayout(next);
  };
  return [layout, setLayout];
}

function LayoutPicker({
  layout,
  onChange,
}: {
  layout: LiveTvLayout;
  onChange: (next: LiveTvLayout) => void;
}) {
  return (
    <div className="live-tv-layout-toggle" role="group" aria-label="Izbira prikaza">
      <button
        type="button"
        className={layout === "classic" ? "is-on" : ""}
        onClick={() => onChange("classic")}
      >
        Klasično
      </button>
      <button type="button" className={layout === "quad" ? "is-on" : ""} onClick={() => onChange("quad")}>
        Kvadrati
      </button>
    </div>
  );
}

type RoundSummary = LiveMatchView["roundSummaries"][number];

function RoundCard({ r, variant = "classic" }: { r: RoundSummary; variant?: LiveTvLayout }) {
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
  const openRound = r.duels.some((d) => d.homePins == null || d.awayPins == null);
  const quad = variant === "quad";
  const topLead = quad ? bigLead : smallLead;
  const topHome = quad ? r.homeBig : r.homeSmall;
  const topAway = quad ? r.awayBig : r.awaySmall;
  return (
    <div className={`live-tv-round-card${openRound ? " is-open" : ""}${quad ? " is-quad" : ""}`}>
      <div className="live-tv-round-card-num">{r.round}. krog</div>
      <div className="live-tv-round-card-score">
        <span className={topLead === "home" ? "is-lead" : undefined}>{topHome ?? "·"}</span>
        <span className="live-tv-duel-vs">:</span>
        <span className={topLead === "away" ? "is-lead" : undefined}>{topAway ?? "·"}</span>
      </div>
      {quad ? (
        <div className="live-tv-round-card-meta">
          <span>Male {pairLabel(r.homeSmall, r.awaySmall)}</span>
          <span>
            {pairLabel(r.homePins, r.awayPins)}
            {r.homePins != null ? " kegljev" : ""}
          </span>
        </div>
      ) : (
        <div className="live-tv-round-card-pins">
          {pairLabel(r.homePins, r.awayPins)}
          {r.homePins != null ? " kegljev" : ""}
        </div>
      )}
      <div className="live-tv-round-duels">
        {r.duels.map((d) => {
          const dLead = duelLead(d.homePins, d.awayPins);
          return (
            <div key={d.lane} className="live-tv-mini-duel">
              <span className="live-tv-mini-lane" data-lane={d.lane}>
                {quad ? `Steza ${d.lane}` : `S${d.lane}`}
              </span>
              <span className={`live-tv-mini-name is-home${dLead === "home" ? " is-lead" : ""}`}>
                {d.homeName}
              </span>
              <span className={`live-tv-mini-pins${dLead === "home" ? " is-lead" : ""}`}>
                {pinsLabel(d.homePins)}
              </span>
              <span className="live-tv-mini-sep">–</span>
              <span className={`live-tv-mini-pins${dLead === "away" ? " is-lead" : ""}`}>
                {pinsLabel(d.awayPins)}
              </span>
              <span className={`live-tv-mini-name is-away${dLead === "away" ? " is-lead" : ""}`}>
                {d.awayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ScreenProps = {
  view: LiveMatchView;
  badge: "live" | "next" | "final";
  rotateLabel?: string | null;
  layout: LiveTvLayout;
  onLayoutChange: (next: LiveTvLayout) => void;
};

function LiveMatchScreen({ view: m, badge, rotateLabel, layout, onLayoutChange }: ScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active: fullscreen, toggle: toggleFullscreen } = useLiveFullscreen(rootRef);
  const complete = m.complete || badge === "final";
  const homeWins = complete && (m.homeMatch ?? 0) > (m.awayMatch ?? 0);
  const awayWins = complete && (m.awayMatch ?? 0) > (m.homeMatch ?? 0);
  const rounds = m.roundSummaries;
  const r1 = rounds[0]!;
  const r2 = rounds[1]!;
  const r3 = rounds[2]!;
  const r4 = rounds[3]!;

  const meta = (
    <div className="live-tv-meta">
      {badge === "final" || (badge === "live" && complete) ? (
        <>
          <span className="live-tv-final-mark" aria-hidden />
          <span className="live-tv-final">Končano</span>
        </>
      ) : badge === "next" ? (
        <>
          <span className="live-tv-final-mark" aria-hidden />
          <span className="live-tv-final">Naslednja</span>
        </>
      ) : (
        <>
          <span className="live-tv-pulse" aria-hidden />
          <span className="live-tv-live">V živo</span>
        </>
      )}
      <span className="live-tv-when">{m.startsAtLabel}</span>
      {rotateLabel ? <span className="live-tv-when">{rotateLabel}</span> : null}
      <LayoutPicker layout={layout} onChange={onLayoutChange} />
      <LiveFullscreenButton active={fullscreen} onToggle={toggleFullscreen} />
    </div>
  );

  if (layout === "quad") {
    return (
      <div
        ref={rootRef}
        className={`live-tv is-quad${complete ? " is-final" : ""}${fullscreen ? " is-fullscreen" : ""}`}
      >
        <div className="live-tv-glow" aria-hidden />
        <header className="live-tv-top">
          <div className="live-tv-brand">
            <img src="/logo-bowling-lenart.png" alt="" className="live-tv-logo" />
            <div>
              <div className="live-tv-brand-name">Bowling Lenart</div>
              <div className="live-tv-brand-sub">Liga · {m.round}. kolo</div>
            </div>
          </div>
          {meta}
        </header>

        <div className="live-quad-board">
          <RoundCard r={r1} variant="quad" />
          <div className="live-quad-spine live-quad-spine-top">
            <div className="live-quad-stat is-featured">
              <span>Velike točke</span>
              <strong>
                {m.homeBig}:{m.awayBig}
              </strong>
            </div>
            <div className="live-quad-stat">
              <span>Male točke</span>
              <strong>
                {m.homeSmall}:{m.awaySmall}
              </strong>
            </div>
          </div>
          <RoundCard r={r2} variant="quad" />

          <div className={`live-quad-mid-label is-home${homeWins ? " is-winner" : ""}`}>
            {m.homeName}
          </div>
          <div className="live-quad-spine live-quad-spine-mid">
            {complete ? (
              <div className="live-quad-stat is-slot-large is-match">
                <span>Končne točke</span>
                <strong>
                  <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
                  <span className="live-tv-score-sep">:</span>
                  <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
                </strong>
              </div>
            ) : (
              <div className="live-quad-stat is-slot-large">
                <span>Keglji</span>
                <strong>
                  {m.homePins}:{m.awayPins}
                </strong>
              </div>
            )}
          </div>
          <div className={`live-quad-mid-label is-away${awayWins ? " is-winner" : ""}`}>
            {m.awayName}
          </div>

          <RoundCard r={r3} variant="quad" />
          <div className="live-quad-spine live-quad-spine-bot">
            {complete ? (
              <div className="live-quad-stat is-slot-small">
                <span>Keglji</span>
                <strong>
                  {m.homePins}:{m.awayPins}
                </strong>
              </div>
            ) : (
              <div className="live-quad-stat is-slot-small is-match is-pending">
                <span>Končne točke</span>
                <strong>·:·</strong>
              </div>
            )}
          </div>
          <RoundCard r={r4} variant="quad" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`live-tv${complete ? " is-final" : ""}${fullscreen ? " is-fullscreen" : ""}`}
    >
      <div className="live-tv-glow" aria-hidden />
      <div className="live-tv-lane" aria-hidden />

      <header className="live-tv-top">
        <div className="live-tv-brand">
          <img src="/logo-bowling-lenart.png" alt="" className="live-tv-logo" />
          <div>
            <div className="live-tv-brand-name">Bowling Lenart</div>
            <div className="live-tv-brand-sub">Liga · {m.round}. kolo</div>
          </div>
        </div>
        {meta}
      </header>

      <section className="live-tv-scoreboard">
        <div className={`live-tv-side is-home${homeWins ? " is-winner" : ""}`}>
          <div className="live-tv-side-label">{homeWins ? "Zmaga" : "Domači"}</div>
          <h1 className="live-tv-team">{m.homeName}</h1>
        </div>

        <div className="live-tv-center">
          <div className="live-tv-score-label">{complete ? "Končne točke" : "Velike točke"}</div>
          <div className="live-tv-score">
            {complete ? (
              <>
                <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
                <span className="live-tv-score-sep">:</span>
                <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
              </>
            ) : (
              <>
                <span>{m.homeBig}</span>
                <span className="live-tv-score-sep">:</span>
                <span>{m.awayBig}</span>
              </>
            )}
          </div>
          <div className="live-tv-stats-featured">
            <div className="live-tv-stat-block">
              <span className="live-tv-stat-label">Male točke</span>
              <strong>
                {m.homeSmall}:{m.awaySmall}
              </strong>
            </div>
            {complete ? (
              <div className="live-tv-stat-block">
                <span className="live-tv-stat-label">Velike točke</span>
                <strong>
                  {m.homeBig}:{m.awayBig}
                </strong>
              </div>
            ) : (
              <div className="live-tv-stat-block">
                <span className="live-tv-stat-label">Keglji</span>
                <strong>
                  {m.homePins}:{m.awayPins}
                </strong>
              </div>
            )}
          </div>
          <div className="live-tv-stats-minor">
            {complete ? (
              <>
                Keglji{" "}
                <strong>
                  {m.homePins}:{m.awayPins}
                </strong>
              </>
            ) : (
              <>
                Končne točke{" "}
                <strong>
                  <span>{m.homeMatch ?? "·"}</span>
                  <span className="live-tv-score-sep">:</span>
                  <span>{m.awayMatch ?? "·"}</span>
                </strong>
              </>
            )}
          </div>
        </div>

        <div className={`live-tv-side is-away${awayWins ? " is-winner" : ""}`}>
          <div className="live-tv-side-label">{awayWins ? "Zmaga" : "Gostje"}</div>
          <h1 className="live-tv-team">{m.awayName}</h1>
        </div>
      </section>

      <section className="live-tv-round">
        <div className="live-tv-round-head">
          <h2>Po krogih</h2>
        </div>
        <div className="live-tv-rounds-grid">
          {m.roundSummaries.map((r) => (
            <RoundCard key={r.round} r={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LiveIdleScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active: fullscreen, toggle: toggleFullscreen } = useLiveFullscreen(rootRef);

  return (
    <div ref={rootRef} className={`live-tv${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="live-tv-glow" aria-hidden />
      <div className="live-tv-lane" aria-hidden />
      <header className="live-tv-top">
        <div className="live-tv-brand">
          <img src="/logo-bowling-lenart.png" alt="" className="live-tv-logo" />
          <div>
            <div className="live-tv-brand-name">Bowling Lenart</div>
            <div className="live-tv-brand-sub">Liga</div>
          </div>
        </div>
        <div className="live-tv-meta">
          <LiveFullscreenButton active={fullscreen} onToggle={toggleFullscreen} />
        </div>
      </header>
      <div className="live-tv-idle">
        <p className="live-tv-idle-title">Trenutno ni tekme v živo</p>
        <p className="live-tv-idle-sub">Prikaz se osveži samodejno.</p>
      </div>
    </div>
  );
}

/** Živi TV prikaz: fiksni URL `?display=live`, pollanje MySQL lige (ali lokalni fallback). */
export function LiveMatchBoard() {
  const { state: storeState, remote } = useStore();
  const [layout, setLayout] = useLiveLayout();
  const [polled, setPolled] = useState<LeagueState | null>(null);
  const [fromDb, setFromDb] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchLeague();
        if (cancelled) return;
        if (payload.storage === "db" && payload.current?.data) {
          setPolled(payload.current.data);
          setFromDb(true);
          setError(false);
        } else if (payload.current?.data) {
          setPolled(payload.current.data);
          setError(false);
        } else {
          // Brez MySQL (npr. Vercel): ostane store / localStorage.
          setFromDb(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, []);

  // Pri MySQL vedno sveži poll; sicer store (isti vir kot razpored).
  const state = fromDb && polled ? polled : (polled ?? storeState);
  const hasData = state.matches.length > 0 || state.teams.length > 0;

  if (booting && !hasData) {
    return (
      <div className="live-tv">
        <div className="live-tv-idle">
          <p className="live-tv-idle-title">Nalaganje…</p>
          <p className="live-tv-idle-sub">Prikaz tekem v živo</p>
        </div>
      </div>
    );
  }

  if (error && !hasData && !remote) {
    return (
      <div className="live-tv">
        <div className="live-tv-idle">
          <p className="live-tv-idle-title">Ni povezave</p>
          <p className="live-tv-idle-sub">Poskusim znova samodejno.</p>
        </div>
      </div>
    );
  }

  const pick = pickLiveBoardMatch(state.matches, state.players, now);
  if (pick.status === "idle") return <LiveIdleScreen />;

  const view = buildLiveMatchView(state, pick.match);
  const badge =
    pick.status === "next" ? "next" : view.complete ? "final" : "live";
  const rotateLabel =
    pick.siblings > 1 ? `${pick.index + 1}/${pick.siblings}` : null;

  return (
    <LiveMatchScreen
      view={view}
      badge={badge}
      rotateLabel={rotateLabel}
      layout={layout}
      onLayoutChange={setLayout}
    />
  );
}

type PreviewProps = {
  preview?: boolean;
  previewPhase?: "live" | "final";
};

/** Predogled layouta z mock podatki (`?display=preview`). */
export function LiveMatchDisplay({ preview = true, previewPhase = "live" }: PreviewProps) {
  const [phase, setPhase] = useState<"live" | "final">(previewPhase);
  const [layout, setLayout] = useLiveLayout();
  const view = phase === "final" ? PREVIEW_FINAL : PREVIEW_LIVE;

  return (
    <>
      <LiveMatchScreen
        view={view}
        badge={phase === "final" ? "final" : "live"}
        layout={layout}
        onLayoutChange={setLayout}
      />
      {preview && (
        <div className="live-tv-preview-bar live-tv-preview-overlay">
          <div className="live-tv-preview-toggle" role="group" aria-label="Predogled faze">
            <button
              type="button"
              className={phase === "live" ? "is-on" : ""}
              onClick={() => setPhase("live")}
            >
              Med tekmo
            </button>
            <button
              type="button"
              className={phase === "final" ? "is-on" : ""}
              onClick={() => setPhase("final")}
            >
              Po koncu
            </button>
          </div>
          <p className="live-tv-preview-note">
            Živo: <code>?display=live</code> · layout zgoraj desno (Klasično / Kvadrati)
          </p>
        </div>
      )}
    </>
  );
}
