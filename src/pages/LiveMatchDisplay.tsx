import { useEffect, useRef, useState, type RefObject } from "react";
import { fetchLeague } from "../lib/leagueApi";
import {
  buildLiveMatchView,
  pickLiveBoardMatch,
  withFinalScoreHold,
  type LiveBoardHold,
  type LiveMatchView,
} from "../lib/liveBoard";
import { shortTvPersonName } from "../lib/labels";
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

/** Med tekmo: fokus 1. kola z vpisanimi igralci (brez kegljev) — za predogled velikosti. */
const PREVIEW_LIVE: LiveMatchView = {
  complete: false,
  round: 1,
  homeName: "Vardam",
  awayName: "Parma",
  homeMatch: null,
  awayMatch: null,
  homeBig: 0,
  awayBig: 0,
  homeSmall: 0,
  awaySmall: 0,
  homePins: 0,
  awayPins: 0,
  startsAtLabel: "TOR 13. 10. 19:00",
  roundSummaries: [
    {
      round: 1,
      homeSmall: null,
      awaySmall: null,
      homeBig: null,
      awayBig: null,
      homePins: null,
      awayPins: null,
      duels: [
        { lane: 1, homeName: "Miha Novak", awayName: "Peter Zupan", homePins: null, awayPins: null, homeSmall: null, awaySmall: null },
        { lane: 2, homeName: "Janez Horvat", awayName: "Luka Vidmar", homePins: null, awayPins: null, homeSmall: null, awaySmall: null },
        { lane: 3, homeName: "Tomaž Kralj", awayName: "Matej Hribar", homePins: null, awayPins: null, homeSmall: null, awaySmall: null },
        { lane: 4, homeName: "Simon Breznik", awayName: "Andrej Kovač", homePins: null, awayPins: null, homeSmall: null, awaySmall: null },
      ],
    },
    {
      round: 2,
      homeSmall: null,
      awaySmall: null,
      homeBig: null,
      awayBig: null,
      homePins: null,
      awayPins: null,
      duels: emptyDuels(LINEUPS[1]!),
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

/** Povečano kolo: uvod (proge) ~5 min, potem pregled; ob vpisu kegljev spet fokus. */
const ROUND_FOCUS_DEFAULT_MS = 5 * 60 * 1000;

function readRoundFocusMs(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("focusMs");
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5_000 && n <= 30 * 60_000) return n;
  // Predogled: kratek fokus (~30 s), da se hitro vidi pregled
  if (params.get("display") === "preview") return 30_000;
  return ROUND_FOCUS_DEFAULT_MS;
}

function roundPinsComplete(r: RoundSummary): boolean {
  return r.duels.length > 0 && r.duels.every((d) => d.homePins != null && d.awayPins != null);
}

function roundHasAnyPins(r: RoundSummary): boolean {
  return r.duels.some((d) => d.homePins != null || d.awayPins != null);
}

/**
 * Ozek zaslon (telefon) — samo klasični TV, brez fokusa kola in brez kvadratov.
 * Namerno brez pointer:coarse, da fokus deluje tudi na touch laptopih / tablicah v širokem oknu.
 */
function useIsHandheldTv(): boolean {
  const query = "(max-width: 820px)";
  const [handheld, setHandheld] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setHandheld(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return handheld;
}

type RoundFocusPhase = {
  mode: "focus" | "overview";
  focusRound: number;
  /** Uvodni fokus: skrij po `until`. Pri scoringu timer ni aktiven. */
  until: number;
  kind: "intro" | "scoring";
};

function initialFocusPhase(rounds: RoundSummary[], focusMs: number): RoundFocusPhase {
  const open = rounds.find((r) => !roundPinsComplete(r));
  const focusRound = open?.round ?? rounds[0]?.round ?? 1;
  const current = rounds.find((r) => r.round === focusRound);
  if (current && roundHasAnyPins(current) && !roundPinsComplete(current)) {
    return { mode: "focus", focusRound, until: 0, kind: "scoring" };
  }
  return { mode: "focus", focusRound, until: Date.now() + focusMs, kind: "intro" };
}

function useRoundFocusPhase(
  rounds: RoundSummary[],
  matchComplete: boolean,
  matchKey: string,
  enabled: boolean,
): RoundFocusPhase {
  const focusMs = useRef(readRoundFocusMs()).current;
  const [phase, setPhase] = useState<RoundFocusPhase>(() => initialFocusPhase(rounds, focusMs));
  const keyRef = useRef(matchKey);

  useEffect(() => {
    if (!enabled) return;
    if (keyRef.current === matchKey) return;
    keyRef.current = matchKey;
    setPhase(initialFocusPhase(rounds, focusMs));
  }, [matchKey, rounds, focusMs, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (matchComplete) {
      setPhase((p) =>
        p.mode === "overview" && p.kind === "intro"
          ? p
          : { mode: "overview", focusRound: p.focusRound, until: 0, kind: "intro" },
      );
      return;
    }
    const tick = () => {
      setPhase((p) => {
        const now = Date.now();
        const maxRound = Math.max(1, rounds.length);
        const focused = rounds.find((r) => r.round === p.focusRound);

        if (p.mode === "focus") {
          if (focused && roundPinsComplete(focused)) {
            if (p.focusRound < maxRound) {
              return {
                mode: "focus",
                focusRound: p.focusRound + 1,
                until: now + focusMs,
                kind: "intro",
              };
            }
            return { mode: "overview", focusRound: p.focusRound, until: 0, kind: "intro" };
          }
          // Med uvodom že vpisujejo → ostani v fokusu do konca kroga
          if (p.kind === "intro" && focused && roundHasAnyPins(focused)) {
            return { mode: "focus", focusRound: p.focusRound, until: 0, kind: "scoring" };
          }
          // Uvod: po 5 min skrij; scoring ostane, dokler krog ni končan
          if (p.kind === "intro" && p.until > 0 && now >= p.until) {
            return { mode: "overview", focusRound: p.focusRound, until: 0, kind: "intro" };
          }
          return p;
        }

        // Pregled: ko začnejo vpisovati keglje tega kola → spet fokus
        if (focused && roundPinsComplete(focused) && p.focusRound < maxRound) {
          return {
            mode: "focus",
            focusRound: p.focusRound + 1,
            until: now + focusMs,
            kind: "intro",
          };
        }
        if (focused && roundHasAnyPins(focused) && !roundPinsComplete(focused)) {
          return { mode: "focus", focusRound: p.focusRound, until: 0, kind: "scoring" };
        }
        return p;
      });
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [rounds, matchComplete, focusMs, matchKey, enabled]);

  return phase;
}

function RoundCard({
  r,
  variant = "classic",
  enlarged = false,
  hideLane = false,
}: {
  r: RoundSummary;
  variant?: LiveTvLayout;
  enlarged?: boolean;
  /** Klasični pregled: S1–S4 so zunaj mreže, v kartici jih skrijemo. */
  hideLane?: boolean;
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
  const pinsText =
    r.homePins != null || r.awayPins != null
      ? `${pairLabel(r.homePins, r.awayPins)} kegljev`
      : "— kegljev";
  return (
    <div
      className={`live-tv-round-card${openRound ? " is-open" : ""}${quad ? " is-quad" : ""}${enlarged ? " is-enlarged" : ""}${hideLane ? " is-no-lane" : ""}`}
    >
      <div className="live-tv-round-card-num">{r.round}. kolo</div>
      <div className="live-tv-round-card-totals">
        <span>
          Velike{" "}
          <strong>
            <span className={bigLead === "home" ? "is-lead" : undefined}>{r.homeBig ?? "·"}</span>
            <span className="live-tv-duel-vs">:</span>
            <span className={bigLead === "away" ? "is-lead" : undefined}>{r.awayBig ?? "·"}</span>
          </strong>
        </span>
        <span>Male {pairLabel(r.homeSmall, r.awaySmall)}</span>
        <span>{pinsText}</span>
      </div>
      <div className="live-tv-round-duels">
        {r.duels.map((d) => {
          const dLead = duelLead(d.homePins, d.awayPins);
          /** Kvadrati pregled: kratka ena vrstica; klasično + fokus: polno ime v 2 vrsticah. */
          const shortOneLine = quad && !enlarged;
          const homeLabel = shortOneLine ? shortTvPersonName(d.homeName) : d.homeName;
          const awayLabel = shortOneLine ? shortTvPersonName(d.awayName) : d.awayName;
          return (
            <div
              key={d.lane}
              className={`live-tv-mini-duel${hideLane ? " is-no-lane" : ""}`}
              data-lane={d.lane}
            >
              {hideLane ? null : (
                <span className="live-tv-mini-lane" data-lane={d.lane}>
                  {quad || enlarged ? `Steza ${d.lane}` : `S${d.lane}`}
                </span>
              )}
              {shortOneLine ? (
                <span
                  className={`live-tv-mini-name is-home is-one-line${dLead === "home" ? " is-lead" : ""}`}
                >
                  {homeLabel}
                </span>
              ) : (
                <TvStackedName name={homeLabel} side="home" lead={dLead === "home"} />
              )}
              <span className={`live-tv-mini-pins${dLead === "home" ? " is-lead" : ""}`}>
                {pinsLabel(d.homePins)}
              </span>
              <span className="live-tv-mini-sep">–</span>
              <span className={`live-tv-mini-pins${dLead === "away" ? " is-lead" : ""}`}>
                {pinsLabel(d.awayPins)}
              </span>
              {shortOneLine ? (
                <span
                  className={`live-tv-mini-name is-away is-one-line${dLead === "away" ? " is-lead" : ""}`}
                >
                  {awayLabel}
                </span>
              ) : (
                <TvStackedName name={awayLabel} side="away" lead={dLead === "away"} />
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
  const handheld = useIsHandheldTv();
  /** Telefon/tablica vedno klasično; računalnik lahko še kvadrate. */
  const effectiveLayout: LiveTvLayout = handheld ? "classic" : layout;
  const complete = m.complete || badge === "final";
  const homeWins = complete && (m.homeMatch ?? 0) > (m.awayMatch ?? 0);
  const awayWins = complete && (m.awayMatch ?? 0) > (m.homeMatch ?? 0);
  const rounds = m.roundSummaries;
  const r1 = rounds[0]!;
  const r2 = rounds[1]!;
  const r3 = rounds[2]!;
  const r4 = rounds[3]!;
  const phaseKey = matchKey ?? `${m.homeName}|${m.awayName}|${m.startsAtLabel}|${m.round}`;
  const focusEnabled = !handheld && badge === "live" && !complete;
  const roundPhase = useRoundFocusPhase(rounds, complete, phaseKey, focusEnabled);
  const focusRound = rounds.find((r) => r.round === roundPhase.focusRound) ?? r1;
  const showRoundFocus = focusEnabled && roundPhase.mode === "focus";
  /** Zoom-in/out fokus (klasično + kvadrati); ostane mountan med izhodom. */
  const [focusOverlay, setFocusOverlay] = useState<{
    round: RoundSummary;
    kind: "intro" | "scoring";
    exiting: boolean;
  } | null>(null);

  useEffect(() => {
    if (!focusEnabled) {
      setFocusOverlay(null);
      return;
    }
    if (showRoundFocus) {
      setFocusOverlay({
        round: focusRound,
        kind: roundPhase.kind,
        exiting: false,
      });
      return;
    }
    setFocusOverlay((prev) => {
      if (!prev || prev.exiting) return prev;
      return { ...prev, exiting: true };
    });
  }, [focusEnabled, showRoundFocus, focusRound, roundPhase.kind]);

  useEffect(() => {
    if (!focusOverlay?.exiting) return;
    const t = window.setTimeout(() => setFocusOverlay(null), 560);
    return () => window.clearTimeout(t);
  }, [focusOverlay?.exiting]);

  const focusOverlayVisible = focusOverlay != null;
  const focusOverlayExiting = focusOverlay?.exiting === true;
  const overlayRound =
    focusOverlay == null
      ? focusRound
      : (rounds.find((r) => r.round === focusOverlay.round.round) ?? focusOverlay.round);

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
          {showRoundFocus || focusOverlayVisible ? (
            <span className="live-tv-when">
              {(focusOverlay?.round.round ?? roundPhase.focusRound)}. kolo
              {(focusOverlay?.kind ?? roundPhase.kind) === "intro" ? " · steze" : " · vpis"}
            </span>
          ) : null}
        </>
      )}
      <span className="live-tv-when">{m.startsAtLabel}</span>
      {rotateLabel ? <span className="live-tv-when">{rotateLabel}</span> : null}
      {!handheld ? <LayoutPicker layout={layout} onChange={onLayoutChange} /> : null}
      <LiveFullscreenButton active={fullscreen} onToggle={toggleFullscreen} />
    </div>
  );

  if (effectiveLayout === "quad") {
    return (
      <div
        ref={rootRef}
        className={`live-tv is-quad${complete ? " is-final" : ""}${fullscreen ? " is-fullscreen" : ""}${focusOverlayVisible ? " is-round-focus" : ""}${focusOverlayExiting ? " is-round-focus-exit" : ""}`}
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

        <div className="live-quad-stage">
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

          {focusOverlay ? (
            <div
              className={`live-quad-focus${focusOverlay.exiting ? " is-zoom-out" : " is-zoom-in"}`}
              aria-live="polite"
            >
              <div className="live-quad-focus-banner">
                <div className={`live-quad-focus-team is-home${homeWins ? " is-winner" : ""}`}>
                  <span className="live-quad-mid-side">Domači</span>
                  <span className="live-quad-mid-team">{m.homeName}</span>
                </div>
                <div className="live-quad-focus-score">
                  <span className="live-quad-focus-stat">
                    M. točke <strong>{m.homeSmall}:{m.awaySmall}</strong>
                  </span>
                  <span className="live-quad-focus-stat">
                    V. točke <strong>{m.homeBig}:{m.awayBig}</strong>
                  </span>
                  <span className="live-quad-focus-stat">
                    Keglji <strong>{m.homePins}:{m.awayPins}</strong>
                  </span>
                </div>
                <div className={`live-quad-focus-team is-away${awayWins ? " is-winner" : ""}`}>
                  <span className="live-quad-mid-side">Gostje</span>
                  <span className="live-quad-mid-team">{m.awayName}</span>
                </div>
              </div>
              <RoundCard r={overlayRound} variant="quad" enlarged />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`live-tv${complete ? " is-final" : ""}${fullscreen ? " is-fullscreen" : ""}${focusOverlayVisible ? " is-round-focus-overlay" : ""}${focusOverlayExiting ? " is-round-focus-exit" : ""}`}
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
          {complete ? (
            <>
              <div className="live-tv-score-label">Končne točke</div>
              <div className="live-tv-score">
                <span className={homeWins ? "is-winner" : undefined}>{m.homeMatch ?? "·"}</span>
                <span className="live-tv-score-sep">:</span>
                <span className={awayWins ? "is-winner" : undefined}>{m.awayMatch ?? "·"}</span>
              </div>
              <div className="live-tv-stats-row is-final-sub">
                <span className="live-tv-stats-row-item">
                  M. točke <strong>{m.homeSmall}:{m.awaySmall}</strong>
                </span>
                <span className="live-tv-stats-row-item">
                  V. točke <strong>{m.homeBig}:{m.awayBig}</strong>
                </span>
                <span className="live-tv-stats-row-item">
                  Keglji <strong>{m.homePins}:{m.awayPins}</strong>
                </span>
              </div>
            </>
          ) : (
            <div className="live-tv-stats-row is-live-hero">
              <span className="live-tv-stats-row-item">
                V. točke <strong>{m.homeBig}:{m.awayBig}</strong>
              </span>
              <span className="live-tv-stats-row-item">
                M. točke <strong>{m.homeSmall}:{m.awaySmall}</strong>
              </span>
              <span className="live-tv-stats-row-item">
                Keglji <strong>{m.homePins}:{m.awayPins}</strong>
              </span>
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
        <div className="live-tv-rounds-wrap">
          <aside className="live-tv-rounds-lanes" aria-label="Steze">
            {/* Samo višina glave kartice — brez širokega besedila, da S1–S4 ostanejo skrajno levo. */}
            <div className="live-tv-rounds-lanes-head" aria-hidden="true">
              <div className="live-tv-round-card-num">&nbsp;</div>
              <div className="live-tv-round-card-totals">&nbsp;</div>
            </div>
            <div className="live-tv-rounds-lanes-body">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="live-tv-rounds-lane-tag">
                  S{n}
                </span>
              ))}
            </div>
          </aside>
          <div className="live-tv-rounds-grid">
            {m.roundSummaries.map((r) => (
              <RoundCard key={r.round} r={r} hideLane />
            ))}
          </div>
        </div>
      </section>

      {focusOverlay ? (
        <div
          className={`live-tv-focus-overlay${focusOverlay.exiting ? " is-zoom-out" : " is-zoom-in"}`}
          aria-live="polite"
        >
          <div className="live-tv-focus-overlay-panel">
            <div className="live-tv-focus-overlay-label">
              {focusOverlay.kind === "intro" ? "Steze · kdo igra" : "Vpis kegljev"} ·{" "}
              {focusOverlay.round.round}. kolo
            </div>
            <RoundCard r={overlayRound} enlarged />
          </div>
        </div>
      ) : null}
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
