import { useEffect, useRef, useState, type RefObject } from "react";
import { fetchLeague } from "../lib/leagueApi";
import {
  buildLiveMatchView,
  pickLiveBoardMatch,
  withFinalScoreHold,
  type LiveBoardHold,
  type LiveMatchView,
} from "../lib/liveBoard";
import { findTrainingSession, formatTrainingDate, trainingAsMatch } from "../lib/training";
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

/** Ime in priimek v dveh vrsticah (klasični TV). */
function splitPersonName(name: string): string[] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["—"];
  if (parts.length === 1) return [parts[0]!];
  return [parts[0]!, parts.slice(1).join(" ")];
}

function TvStackedName({
  name,
  side,
  lead,
}: {
  name: string;
  side: "home" | "away";
  lead?: boolean;
}) {
  return (
    <span className={`live-tv-mini-name is-${side}${lead ? " is-lead" : ""}`}>
      {splitPersonName(name).map((line, i) => (
        <span key={i} className="live-tv-mini-name-line">
          {line}
        </span>
      ))}
    </span>
  );
}

const emptyDuels = (names: [string, string][]): DuelRow[] =>
  names.map(([homeName, awayName], i) => ({
    lane: i + 1,
    homeName,
    awayName,
    homePins: null,
    awayPins: null,
    homeSmall: null,
    awaySmall: null,
  }));

const LINEUPS: [string, string][][] = [
  [
    ["Miha Novak", "Peter Zupan"],
    ["Janez Horvat", "Luka Vidmar"],
    ["Tomaž Kralj", "Matej Hribar"],
    ["Simon Breznik", "Andrej Kovač"],
  ],
  [
    ["Tomaž Kralj", "Andrej Kovač"],
    ["Simon Breznik", "Matej Hribar"],
    ["Miha Novak", "Luka Vidmar"],
    ["Janez Horvat", "Peter Zupan"],
  ],
  [
    ["Janez Horvat", "Matej Hribar"],
    ["Miha Novak", "Andrej Kovač"],
    ["Simon Breznik", "Peter Zupan"],
    ["Tomaž Kralj", "Luka Vidmar"],
  ],
  [
    ["Simon Breznik", "Luka Vidmar"],
    ["Tomaž Kralj", "Matej Hribar"],
    ["Janez Horvat", "Andrej Kovač"],
    ["Miha Novak", "Peter Zupan"],
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
        { lane: 1, homeName: "Miha Novak", awayName: "Peter Zupan", homePins: 187, awayPins: 162, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Janez Horvat", awayName: "Luka Vidmar", homePins: 201, awayPins: 178, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "Tomaž Kralj", awayName: "Matej Hribar", homePins: 168, awayPins: 155, homeSmall: 2, awaySmall: 0 },
        { lane: 4, homeName: "Simon Breznik", awayName: "Andrej Kovač", homePins: 156, awayPins: 183, homeSmall: 0, awaySmall: 2 },
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
        { lane: 1, homeName: "Tomaž Kralj", awayName: "Andrej Kovač", homePins: 172, awayPins: 160, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Simon Breznik", awayName: "Matej Hribar", homePins: 145, awayPins: 158, homeSmall: 0, awaySmall: 2 },
        { lane: 3, homeName: "Miha Novak", awayName: "Luka Vidmar", homePins: 190, awayPins: null, homeSmall: null, awaySmall: null },
        { lane: 4, homeName: "Janez Horvat", awayName: "Peter Zupan", homePins: null, awayPins: null, homeSmall: null, awaySmall: null },
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
        { lane: 1, homeName: "Miha Novak", awayName: "Peter Zupan", homePins: 187, awayPins: 162, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Janez Horvat", awayName: "Luka Vidmar", homePins: 201, awayPins: 178, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "Tomaž Kralj", awayName: "Matej Hribar", homePins: 168, awayPins: 155, homeSmall: 2, awaySmall: 0 },
        { lane: 4, homeName: "Simon Breznik", awayName: "Andrej Kovač", homePins: 156, awayPins: 183, homeSmall: 0, awaySmall: 2 },
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
        { lane: 1, homeName: "Tomaž Kralj", awayName: "Andrej Kovač", homePins: 172, awayPins: 160, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Simon Breznik", awayName: "Matej Hribar", homePins: 145, awayPins: 158, homeSmall: 0, awaySmall: 2 },
        { lane: 3, homeName: "Miha Novak", awayName: "Luka Vidmar", homePins: 190, awayPins: 171, homeSmall: 2, awaySmall: 0 },
        { lane: 4, homeName: "Janez Horvat", awayName: "Peter Zupan", homePins: 193, awayPins: 181, homeSmall: 2, awaySmall: 0 },
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
        { lane: 1, homeName: "Janez Horvat", awayName: "Matej Hribar", homePins: 178, awayPins: 166, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Miha Novak", awayName: "Andrej Kovač", homePins: 185, awayPins: 149, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "Simon Breznik", awayName: "Peter Zupan", homePins: 152, awayPins: 170, homeSmall: 0, awaySmall: 2 },
        { lane: 4, homeName: "Tomaž Kralj", awayName: "Luka Vidmar", homePins: 178, awayPins: 184, homeSmall: 0, awaySmall: 2 },
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
        { lane: 1, homeName: "Simon Breznik", awayName: "Luka Vidmar", homePins: 178, awayPins: 165, homeSmall: 2, awaySmall: 0 },
        { lane: 2, homeName: "Tomaž Kralj", awayName: "Matej Hribar", homePins: 192, awayPins: 171, homeSmall: 2, awaySmall: 0 },
        { lane: 3, homeName: "Janez Horvat", awayName: "Andrej Kovač", homePins: 168, awayPins: 184, homeSmall: 0, awaySmall: 2 },
        { lane: 4, homeName: "Miha Novak", awayName: "Peter Zupan", homePins: 205, awayPins: 159, homeSmall: 2, awaySmall: 0 },
      ],
    },
  ],
};

const POLL_MS = 2_000;

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

/** Kvadrati: kolo čez zaslon, nato pregled; po koncu kroga spet fokus. */
const QUAD_FOCUS_DEFAULT_MS = 5 * 60 * 1000;

function readQuadFocusMs(): number {
  const raw = new URLSearchParams(window.location.search).get("focusMs");
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5_000 && n <= 30 * 60_000) return n;
  return QUAD_FOCUS_DEFAULT_MS;
}

function roundPinsComplete(r: RoundSummary): boolean {
  return r.duels.length > 0 && r.duels.every((d) => d.homePins != null && d.awayPins != null);
}

type QuadPhase = {
  mode: "focus" | "overview";
  /** Kolo v fokusu / kolo, na katerega čakamo dokončanje v overview. */
  focusRound: number;
  until: number;
};

function useQuadRoundPhase(
  rounds: RoundSummary[],
  matchComplete: boolean,
  matchKey: string,
): QuadPhase {
  const focusMs = useRef(readQuadFocusMs()).current;
  const [phase, setPhase] = useState<QuadPhase>(() => ({
    mode: "focus",
    focusRound: 1,
    until: Date.now() + focusMs,
  }));
  const keyRef = useRef(matchKey);

  useEffect(() => {
    if (keyRef.current === matchKey) return;
    keyRef.current = matchKey;
    const first = rounds.find((r) => !roundPinsComplete(r))?.round ?? 1;
    setPhase({ mode: "focus", focusRound: first, until: Date.now() + focusMs });
  }, [matchKey, rounds, focusMs]);

  useEffect(() => {
    if (matchComplete) {
      setPhase((p) =>
        p.mode === "overview" ? p : { mode: "overview", focusRound: p.focusRound, until: 0 },
      );
      return;
    }
    const tick = () => {
      setPhase((p) => {
        const now = Date.now();
        const maxRound = Math.max(1, rounds.length);
        const focused = rounds.find((r) => r.round === p.focusRound);

        if (p.mode === "focus") {
          if (focused && roundPinsComplete(focused) && p.focusRound < maxRound) {
            return { mode: "focus", focusRound: p.focusRound + 1, until: now + focusMs };
          }
          if (now >= p.until) {
            return { mode: "overview", focusRound: p.focusRound, until: 0 };
          }
          return p;
        }

        // overview: ko se trenutno kolo zaključi → naslednje na veliko
        if (focused && roundPinsComplete(focused) && p.focusRound < maxRound) {
          return { mode: "focus", focusRound: p.focusRound + 1, until: now + focusMs };
        }
        return p;
      });
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [rounds, matchComplete, focusMs, matchKey]);

  return phase;
}

function RoundCard({
  r,
  variant = "classic",
  enlarged = false,
}: {
  r: RoundSummary;
  variant?: LiveTvLayout;
  enlarged?: boolean;
}) {
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
  return (
    <div
      className={`live-tv-round-card${openRound ? " is-open" : ""}${quad ? " is-quad" : ""}${enlarged ? " is-enlarged" : ""}`}
    >
      <div className="live-tv-round-card-num">{r.round}. krog</div>
      <div className="live-tv-round-card-score">
        <span className={bigLead === "home" ? "is-lead" : undefined}>{r.homeBig ?? "·"}</span>
        <span className="live-tv-duel-vs">:</span>
        <span className={bigLead === "away" ? "is-lead" : undefined}>{r.awayBig ?? "·"}</span>
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
        <>
          <div className="live-tv-round-card-meta">
            <span>Male {pairLabel(r.homeSmall, r.awaySmall)}</span>
          </div>
          <div className="live-tv-round-card-pins">
            {pairLabel(r.homePins, r.awayPins)}
            {r.homePins != null ? " kegljev" : ""}
          </div>
        </>
      )}
      <div className="live-tv-round-duels">
        {r.duels.map((d) => {
          const dLead = duelLead(d.homePins, d.awayPins);
          return (
            <div key={d.lane} className="live-tv-mini-duel">
              <span className="live-tv-mini-lane" data-lane={d.lane}>
                {quad ? `Steza ${d.lane}` : `S${d.lane}`}
              </span>
              {quad ? (
                <span className={`live-tv-mini-name is-home${dLead === "home" ? " is-lead" : ""}`}>
                  {d.homeName}
                </span>
              ) : (
                <TvStackedName name={d.homeName} side="home" lead={dLead === "home"} />
              )}
              <span className={`live-tv-mini-pins${dLead === "home" ? " is-lead" : ""}`}>
                {pinsLabel(d.homePins)}
              </span>
              <span className="live-tv-mini-sep">–</span>
              <span className={`live-tv-mini-pins${dLead === "away" ? " is-lead" : ""}`}>
                {pinsLabel(d.awayPins)}
              </span>
              {quad ? (
                <span className={`live-tv-mini-name is-away${dLead === "away" ? " is-lead" : ""}`}>
                  {d.awayName}
                </span>
              ) : (
                <TvStackedName name={d.awayName} side="away" lead={dLead === "away"} />
              )}
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
  /** Npr. „Trening“ namesto „Liga · n. kolo“. */
  brandSub?: string;
  /** Stabilen id tekme za reset fokusa kroga na TV. */
  matchKey?: string;
};

function LiveMatchScreen({
  view: m,
  badge,
  rotateLabel,
  layout,
  onLayoutChange,
  brandSub,
  matchKey,
}: ScreenProps) {
  const sub = brandSub ?? `Liga · ${m.round}. kolo`;
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
  const phaseKey = matchKey ?? `${m.homeName}|${m.awayName}|${m.startsAtLabel}|${m.round}`;
  const quadPhase = useQuadRoundPhase(rounds, complete, phaseKey);
  const focusRound = rounds.find((r) => r.round === quadPhase.focusRound) ?? r1;
  const showRoundFocus =
    layout === "quad" && badge === "live" && !complete && quadPhase.mode === "focus";

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
          {showRoundFocus ? (
            <span className="live-tv-when">{quadPhase.focusRound}. krog · fokus</span>
          ) : null}
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
        className={`live-tv is-quad${complete ? " is-final" : ""}${fullscreen ? " is-fullscreen" : ""}${showRoundFocus ? " is-round-focus" : ""}`}
      >
        <div className="live-tv-glow" aria-hidden />
        <header className="live-tv-top">
          <div className="live-tv-brand">
            <img src="/logo-bowling-lenart.png" alt="" className="live-tv-logo" />
            <div>
              <div className="live-tv-brand-name">Bowling Lenart</div>
              <div className="live-tv-brand-sub">{sub}</div>
            </div>
          </div>
          {meta}
        </header>

        {showRoundFocus ? (
          <div className="live-quad-focus">
            <div className="live-quad-focus-banner">
              <div className={`live-quad-focus-team is-home${homeWins ? " is-winner" : ""}`}>
                <span className="live-quad-mid-side">Domači</span>
                <span className="live-quad-mid-team">{m.homeName}</span>
              </div>
              <div className="live-quad-focus-score">
                <span className="live-quad-focus-score-label">Velike</span>
                <strong>
                  {m.homeBig}:{m.awayBig}
                </strong>
                <span className="live-quad-focus-score-sub">
                  Male {m.homeSmall}:{m.awaySmall} · keglji {m.homePins}:{m.awayPins}
                </span>
              </div>
              <div className={`live-quad-focus-team is-away${awayWins ? " is-winner" : ""}`}>
                <span className="live-quad-mid-side">Gostje</span>
                <span className="live-quad-mid-team">{m.awayName}</span>
              </div>
            </div>
            <RoundCard r={focusRound} variant="quad" enlarged />
          </div>
        ) : (
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
              <span className="live-quad-mid-side">Domači</span>
              <span className="live-quad-mid-team">{m.homeName}</span>
            </div>
            <div className="live-quad-spine live-quad-spine-mid">
              <div className={`live-quad-stat is-slot-large${complete ? " is-match" : ""}`}>
                <span>{complete ? "Končne točke" : "Keglji"}</span>
                <strong>
                  {complete ? (
                    <>
                      <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
                      <span className="live-tv-score-sep">:</span>
                      <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
                    </>
                  ) : (
                    <>
                      {m.homePins}:{m.awayPins}
                    </>
                  )}
                </strong>
              </div>
            </div>
            <div className={`live-quad-mid-label is-away${awayWins ? " is-winner" : ""}`}>
              <span className="live-quad-mid-side">Gostje</span>
              <span className="live-quad-mid-team">{m.awayName}</span>
            </div>

            <RoundCard r={r3} variant="quad" />
            <div className="live-quad-spine live-quad-spine-bot">
              <div
                className={`live-quad-stat is-slot-small${complete ? "" : " is-match is-pending"}`}
              >
                <span>{complete ? "Keglji" : "Končne točke"}</span>
                <strong>
                  {complete ? (
                    <>
                      {m.homePins}:{m.awayPins}
                    </>
                  ) : (
                    "·:·"
                  )}
                </strong>
              </div>
            </div>
            <RoundCard r={r4} variant="quad" />
          </div>
        )}
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
            <div className="live-tv-brand-sub">{sub}</div>
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
          {complete ? (
            <div className="live-tv-stats-featured is-bottom">
              <div className="live-tv-stat-block">
                <span className="live-tv-stat-label">Keglji</span>
                <strong>
                  {m.homePins}:{m.awayPins}
                </strong>
              </div>
            </div>
          ) : (
            <div className="live-tv-stats-minor">
              Končne točke{" "}
              <strong>
                <span>{m.homeMatch ?? "·"}</span>
                <span className="live-tv-score-sep">:</span>
                <span>{m.awayMatch ?? "·"}</span>
              </strong>
            </div>
          )}
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
  const holdRef = useRef<LiveBoardHold | null>(null);
  const lastShownRef = useRef<string | null>(null);

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

  const basePick = pickLiveBoardMatch(state.matches, state.players, now);
  const held = withFinalScoreHold(
    basePick,
    state.matches,
    state.players,
    now,
    holdRef.current,
    lastShownRef.current,
  );
  holdRef.current = held.hold;
  const pick = held.pick;
  if (pick.status === "idle") {
    lastShownRef.current = null;
    return <LiveIdleScreen />;
  }
  lastShownRef.current = pick.match.id;

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
      matchKey={pick.match.id}
    />
  );
}

type PreviewProps = {
  preview?: boolean;
  previewPhase?: "live" | "final";
};

/** TV za admin trening: `?display=training&id=<sessionId>`. */
export function TrainingLiveBoard({ sessionId }: { sessionId: string }) {
  const { state: storeState } = useStore();
  const [layout, setLayout] = useLiveLayout();
  const [polled, setPolled] = useState<LeagueState | null>(null);
  const [fromDb, setFromDb] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await fetchLeague();
        if (cancelled) return;
        if (payload.current?.data) {
          setPolled(payload.current.data);
          setFromDb(payload.storage === "db");
        } else {
          setFromDb(false);
        }
      } catch {
        /* ostane store */
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  const state = fromDb && polled ? polled : (polled ?? storeState);
  const session = findTrainingSession(state, sessionId);

  if (booting && !session) {
    return (
      <div className="live-tv">
        <div className="live-tv-idle">
          <p className="live-tv-idle-title">Nalaganje…</p>
          <p className="live-tv-idle-sub">Trening TV</p>
        </div>
      </div>
    );
  }

  if (!session?.match) {
    return (
      <div className="live-tv">
        <div className="live-tv-idle">
          <p className="live-tv-idle-title">Trening ni najden</p>
          <p className="live-tv-idle-sub">Preveri, da je seja odprta in shranjena.</p>
        </div>
      </div>
    );
  }

  const packed = session.match;
  const match = trainingAsMatch(session.id, packed);
  const homeLabel =
    state.teams.find((t) => t.id === packed.homeTeamId)?.name || packed.homeName || "Skupina A";
  const awayLabel =
    state.teams.find((t) => t.id === packed.awayTeamId)?.name || packed.awayName || "Skupina B";
  const view: LiveMatchView = {
    ...buildLiveMatchView(state, match, { homeName: homeLabel, awayName: awayLabel }),
    startsAtLabel: formatTrainingDate(session.date),
  };
  const badge = view.complete ? "final" : "live";

  return (
    <LiveMatchScreen
      view={view}
      badge={badge}
      layout={layout}
      onLayoutChange={setLayout}
      brandSub="Trening"
      matchKey={session.id}
    />
  );
}

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
