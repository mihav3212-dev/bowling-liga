import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { leagueSeasonTitle, officialRoundMeta, inferSeasonKey } from "../lib/fixtures";
import { fetchLeague } from "../lib/leagueApi";
import { formatMatchWhen } from "../lib/labels";
import { MATCH_SLOT_MS, matchesShowingLive } from "../lib/live";
import { byeTeamName } from "../lib/schedule";
import { matchTotals } from "../lib/scoring";
import { computeWeekRecap, recapHasData, type RecapLine } from "../lib/recap";
import {
  computePlayerStandings,
  computeStandings,
  lastCompletedRound,
  playersByAverage,
  type PlayerStandingRow,
  type StandingRow,
} from "../lib/standings";
import { useStore } from "../lib/store";
import type { LeagueState } from "../lib/types";

const POLL_MS = 5_000;
const SLIDE_MS = 22_000;
const PROMO_MS = 18_000;
const PLAYERS_SCROLL_PX_PER_SEC = 32;

type SlideId = "standings" | "players" | "schedule" | "results" | "promo";

const SLIDE_LABEL: Record<SlideId, string> = {
  standings: "Ekipe",
  players: "Igralci",
  schedule: "Razpored",
  results: "Rezultati",
  promo: "Splet",
};

const LEAGUE_WEB_URL = "https://liga.bowlinglenart.si";

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&color=0c0b0b&bgcolor=f4f2ef&data=${encodeURIComponent(data)}`;
}

function slideDurationMs(id: SlideId, playerCount: number): number {
  if (id === "promo") return PROMO_MS;
  if (id === "standings") return 28_000;
  if (id === "players") {
    // One scroll pass: pause top + scroll rest rows + pause bottom.
    const rest = Math.max(0, playerCount - 3);
    const scrollMs = Math.ceil((rest * 44) / PLAYERS_SCROLL_PX_PER_SEC) * 1000;
    return Math.max(28_000, Math.min(95_000, 1600 + scrollMs + 3200));
  }
  if (id === "results") return 30_000;
  return SLIDE_MS;
}

function useFullscreen(rootRef: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [rootRef]);
  const toggle = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  };
  return { active, toggle };
}

function activeScheduleRound(state: LeagueState, now: number): number | null {
  const { matches, players } = state;
  if (matches.length === 0) return null;
  const incomplete = matches.filter((m) => !matchTotals(m, players).complete);
  const live = matchesShowingLive(incomplete, now);
  if (live[0]) return live[0].round;
  if (incomplete.length === 0) return Math.max(...matches.map((m) => m.round));
  let bestRound: number | null = null;
  let bestStart: number | null = null;
  for (const m of incomplete) {
    if (!m.startsAt) continue;
    const t = new Date(m.startsAt).getTime();
    if (Number.isNaN(t) || t < now - MATCH_SLOT_MS) continue;
    if (bestStart == null || t < bestStart) {
      bestStart = t;
      bestRound = m.round;
    }
  }
  if (bestRound != null) return bestRound;
  return Math.min(...incomplete.map((m) => m.round));
}

function slideList(_state: LeagueState, _now: number): SlideId[] {
  // Always keep all five tabs; empty slides show a message.
  return ["standings", "players", "schedule", "results", "promo"];
}

function BoardHeader({
  title,
  sub,
  fullscreen,
  onFullscreen,
}: {
  title: string;
  sub: string;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <header className="liga-board-top">
      <div className="liga-board-brand">
        <img src="/logo-bowling-lenart.png" alt="" className="liga-board-logo" />
        <div>
          <div className="liga-board-brand-name">Bowling Lenart</div>
          <div className="liga-board-brand-sub">{sub}</div>
        </div>
      </div>
      <div className="liga-board-meta">
        <h1 className="liga-board-title">{title}</h1>
        <button
          type="button"
          className="liga-board-fs"
          onClick={() => void onFullscreen()}
          title={fullscreen ? "Izhod iz celozaslonskega" : "Cel zaslon"}
        >
          {fullscreen ? "Zapri" : "Cel zaslon"}
        </button>
      </div>
    </header>
  );
}

function formatRecapPeople(lines: RecapLine[]): string {
  if (lines.length === 0) return "—";
  return lines
    .map((line) => `${line.name}${line.team ? ` (${line.team})` : ""}`)
    .join(", ");
}

function groupRecapLines(lines: RecapLine[]): { value: number; rank: number; people: RecapLine[] }[] {
  const groups: { value: number; rank: number; people: RecapLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.value === line.value) {
      last.people.push(line);
    } else {
      groups.push({ value: line.value, rank: line.rank ?? groups.length + 1, people: [line] });
    }
  }
  return groups;
}

function TopFiveList({ lines }: { lines: RecapLine[] }) {
  return (
    <ol className="liga-board-season-best-ol">
      {groupRecapLines(lines).map((group) => (
        <li key={`${group.rank}-${group.value}-${group.people[0]?.name}`}>
          <span className="mono liga-board-season-best-score">{group.value}</span>
          <div className="liga-board-season-best-names">
            {group.people.map((line, i) => (
              <span key={`${line.name}-${i}`} className="liga-board-season-best-person">
                {i === 0 ? `${group.rank}. ` : ""}
                {line.name}
                {line.team ? ` (${line.team})` : ""}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TeamPodium({ row, place }: { row: StandingRow; place: 1 | 2 | 3 }) {
  const medal = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  return (
    <article className={`liga-board-podium is-${medal} is-place-${place} is-team`}>
      <div className="liga-board-podium-badge" aria-hidden>
        {place}
      </div>
      <h3 className="liga-board-podium-name">{row.team.name}</h3>
      <p className="liga-board-podium-avg mono">{row.big}</p>
      <p className="liga-board-podium-avg-label">točke</p>
      <div className="liga-board-podium-stats is-team">
        <span>
          <em>Z/P/R</em>
          <strong className="mono">
            {row.won}/{row.lost}/{row.drawn}
          </strong>
        </span>
        <span>
          <em>Igre</em>
          <strong className="mono">{row.played}</strong>
        </span>
        <span>
          <em>Velike</em>
          <strong className="mono">{row.velike}</strong>
        </span>
        <span>
          <em>Male</em>
          <strong className="mono">{row.small}</strong>
        </span>
        <span>
          <em>Keglji</em>
          <strong className="mono">{row.pins}</strong>
        </span>
        <span>
          <em>Povp.</em>
          <strong className="mono">{row.teamAvg.toFixed(0)}</strong>
        </span>
      </div>
    </article>
  );
}

function StandingsSlide({ state }: { state: LeagueState }) {
  const rows = computeStandings(state);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const recap = computeWeekRecap(state);
  const showRecap = recapHasData(recap);
  const podiumOrder =
    top.length >= 3 ? [top[1]!, top[0]!, top[2]!] : top.length === 2 ? [top[1]!, top[0]!] : top;

  return (
    <div className="liga-board-slide is-standings-teams">
      <div className="liga-board-teams-bg" aria-hidden>
        <img src="/liga-board-teams-bg.jpg" alt="" />
      </div>
      <div className="liga-board-teams-veil" aria-hidden />
      <div className="liga-board-standings-content">
        {top.length > 0 ? (
          <div className="liga-board-podium-row">
            {podiumOrder.map((row) => {
              const place = (rows.indexOf(row) + 1) as 1 | 2 | 3;
              return <TeamPodium key={row.team.id} row={row} place={place} />;
            })}
          </div>
        ) : null}
        <div className="liga-board-standings-bottom">
          <div className="liga-board-panel liga-board-standings-main">
            <table className="liga-board-table is-compact is-teams-board">
              <thead>
                <tr>
                  <th className="is-num">#</th>
                  <th className="is-name">Ekipa</th>
                  <th className="is-num">I</th>
                  <th className="is-num">Z</th>
                  <th className="is-num">P</th>
                  <th className="is-num">R</th>
                  <th className="is-num">Velike</th>
                  <th className="is-num">Male</th>
                  <th className="is-num">Keglji</th>
                  <th className="is-num">Točke</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((row, i) => (
                  <tr key={row.team.id}>
                    <td className="mono liga-board-rank is-num">{i + 4}</td>
                    <td className="liga-board-name is-name">{row.team.name}</td>
                    <td className="mono is-num">{row.played}</td>
                    <td className="mono is-num">{row.won}</td>
                    <td className="mono is-num">{row.lost}</td>
                    <td className="mono is-num">{row.drawn}</td>
                    <td className="mono is-num">{row.velike}</td>
                    <td className="mono is-num">{row.small}</td>
                    <td className="mono is-num">{row.pins}</td>
                    <td className="mono liga-board-pts is-num">{row.big}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showRecap ? (
            <aside className="liga-board-season-best">
              <h3 className="liga-board-season-best-title">Najboljši rezultati sezone</h3>
              <div className="liga-board-season-best-grid">
                <div className="liga-board-season-best-card">
                  <span className="liga-board-season-best-label">Največ kegljev — posamezno</span>
                  <strong className="mono liga-board-season-best-value">
                    {recap.bestSingle[0]?.value ?? "—"}
                  </strong>
                  <span className="liga-board-season-best-who">
                    {formatRecapPeople(recap.bestSingle)}
                  </span>
                </div>
                <div className="liga-board-season-best-card">
                  <span className="liga-board-season-best-label">Najboljša igra — 4 igre</span>
                  <strong className="mono liga-board-season-best-value">
                    {recap.bestSeries[0]?.value ?? "—"}
                  </strong>
                  <span className="liga-board-season-best-who">
                    {formatRecapPeople(recap.bestSeries)}
                  </span>
                </div>
                <div className="liga-board-season-best-card">
                  <span className="liga-board-season-best-label">Največ kegljev — ekipno</span>
                  <strong className="mono liga-board-season-best-value">
                    {recap.bestTeam[0]?.value ?? "—"}
                  </strong>
                  <span className="liga-board-season-best-who">
                    {formatRecapPeople(recap.bestTeam)}
                  </span>
                </div>
              </div>
              <div className="liga-board-season-best-lists">
                <div>
                  <h4>TOP 5 — posamezna igra</h4>
                  <TopFiveList lines={recap.topSingles} />
                </div>
                <div>
                  <h4>TOP 5 — 4 igre</h4>
                  <TopFiveList lines={recap.topSeries} />
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlayerPodium({ row, place }: { row: PlayerStandingRow; place: 1 | 2 | 3 }) {
  const medal = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  return (
    <article className={`liga-board-podium is-${medal} is-place-${place}`}>
      <div className="liga-board-podium-badge" aria-hidden>
        {place}
      </div>
      <h3 className="liga-board-podium-name">{row.player.name}</h3>
      <p className="liga-board-podium-team">{row.teamName}</p>
      <p className="liga-board-podium-avg mono">{row.avg.toFixed(1)}</p>
      <p className="liga-board-podium-avg-label">povprečje</p>
      <div className="liga-board-podium-stats is-player">
        <span>
          <em>Keglji</em>
          <strong className="mono">{row.pins}</strong>
        </span>
        <span>
          <em>Igre</em>
          <strong className="mono">{row.games}</strong>
        </span>
        <span>
          <em>Najboljša</em>
          <strong className="mono">{row.best}</strong>
        </span>
        <span>
          <em>200+</em>
          <strong className="mono">{row.over200}</strong>
        </span>
      </div>
    </article>
  );
}

function PlayersSlide({ state, active }: { state: LeagueState; active: boolean }) {
  const players = playersByAverage(computePlayerStandings(state));
  const top = players.slice(0, 3);
  const rest = players.slice(3);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || rest.length === 0) return;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    let offset = 0;
    let phase: "waitTop" | "scroll" | "waitBottom" | "done" = "waitTop";
    let phaseUntil = last + 1600;
    // Native scroll so sticky thead stays visible.
    track.style.transform = "";
    viewport.scrollTop = 0;

    const tick = (t: number) => {
      const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (phase !== "done" && max > 8) {
        if (phase === "waitTop" && t >= phaseUntil) {
          phase = "scroll";
        } else if (phase === "scroll") {
          const dt = Math.min(0.05, (t - last) / 1000);
          offset = Math.min(max, offset + PLAYERS_SCROLL_PX_PER_SEC * dt);
          viewport.scrollTop = offset;
          if (offset >= max - 0.5) {
            phase = "waitBottom";
            phaseUntil = t + 2400;
          }
        } else if (phase === "waitBottom" && t >= phaseUntil) {
          // One pass only — hold at bottom until the slide advances.
          phase = "done";
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, rest.length]);

  // Podium order visually: 2 · 1 · 3
  const podiumOrder =
    top.length >= 3 ? [top[1]!, top[0]!, top[2]!] : top.length === 2 ? [top[1]!, top[0]!] : top;

  return (
    <div className="liga-board-slide is-players">
      <div className="liga-board-players-bg" aria-hidden>
        <img src="/liga-board-players-bg.jpg" alt="" />
      </div>
      <div className="liga-board-players-veil" aria-hidden />
      <div className="liga-board-players-content">
        {top.length > 0 ? (
          <div className="liga-board-podium-row">
            {podiumOrder.map((row) => {
              const place = (players.indexOf(row) + 1) as 1 | 2 | 3;
              return <PlayerPodium key={row.player.id} row={row} place={place} />;
            })}
          </div>
        ) : (
          <p className="liga-board-empty">Še ni odigranih iger.</p>
        )}
        {rest.length > 0 ? (
          <div className="liga-board-panel liga-board-scroll-viewport is-rest" ref={viewportRef}>
            <div className="liga-board-scroll-track" ref={trackRef}>
              <table className="liga-board-table is-players-board is-sticky-head">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Igralec</th>
                    <th>Ekipa</th>
                    <th>Keglji</th>
                    <th>Igre</th>
                    <th>Povp.</th>
                    <th>Najb.</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((row, i) => (
                    <tr key={row.player.id}>
                      <td className="mono liga-board-rank">{i + 4}</td>
                      <td className="liga-board-name">{row.player.name}</td>
                      <td className="liga-board-team">{row.teamName}</td>
                      <td className="mono">{row.pins}</td>
                      <td className="mono">{row.games}</td>
                      <td className="mono liga-board-pts">{row.avg.toFixed(1)}</td>
                      <td className="mono">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PromoSlide() {
  const url = LEAGUE_WEB_URL;
  return (
    <div className="liga-board-slide is-promo">
      <div className="liga-board-promo-bg" aria-hidden>
        <img src="/liga-board-promo-bg.jpg" alt="" />
      </div>
      <div className="liga-board-promo-veil" aria-hidden />
      <div className="liga-board-promo">
        <img src="/logo-bowling-lenart.png" alt="" className="liga-board-promo-logo" />
        <div className="liga-board-promo-copy">
          <p className="liga-board-promo-kicker">Bowling Lenart · Liga</p>
          <h2 className="liga-board-promo-title">Spremljajte nas v živo</h2>
          <p className="liga-board-promo-text">
            Od letos lahko tekme spremljate tudi prek spleta — rezultati se osvežujejo v živo.
          </p>
          <p className="liga-board-promo-url mono">liga.bowlinglenart.si</p>
        </div>
        <div className="liga-board-promo-qr">
          <img src={qrImageUrl(url)} alt="QR koda za liga.bowlinglenart.si" width={420} height={420} />
          <span>Skeniraj za spletno ligo</span>
        </div>
      </div>
    </div>
  );
}

function scheduleRoundsPair(state: LeagueState, now: number): number[] {
  const active = activeScheduleRound(state, now);
  if (active == null) return [];
  const all = [...new Set(state.matches.map((m) => m.round))].sort((a, b) => a - b);
  const next = all.find((r) => r > active);
  if (next != null) return [active, next];
  const prev = [...all].reverse().find((r) => r < active);
  if (prev != null) return [prev, active];
  return [active];
}

function ScheduleSlide({ state, now }: { state: LeagueState; now: number }) {
  const rounds = scheduleRoundsPair(state, now);
  const seasonKey = inferSeasonKey(state);
  if (rounds.length === 0) {
    return (
      <div className="liga-board-slide liga-board-empty-wrap">
        <p className="liga-board-empty">Ni razporeda.</p>
      </div>
    );
  }

  return (
    <div className="liga-board-slide is-schedule-grid">
      <div className="liga-board-schedule-bg" aria-hidden>
        <img src="/liga-board-schedule-bg.jpg" alt="" />
      </div>
      <div className="liga-board-schedule-veil" aria-hidden />
      <div className="liga-board-schedule-content">
        {rounds.map((round) => {
          const fixtures = state.matches
            .filter((m) => m.round === round)
            .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
          const meta = officialRoundMeta(round, seasonKey);
          const bye = meta?.bye ?? byeTeamName(round, state.teams, state.matches);
          const label = meta?.label || state.roundLabels?.[String(round)];
          return (
            <section key={round} className="liga-board-schedule-block">
              <div className="liga-board-schedule-head">
                <h2 className="liga-board-section">
                  {round}. kolo{label ? ` — ${label}` : ""}
                </h2>
                {bye ? <p className="liga-board-bye">Počiva: {bye}</p> : null}
              </div>
              <div className="liga-board-cards is-3col">
                {fixtures.map((match) => {
                  const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
                  const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
                  const totals = matchTotals(match, state.players);
                  const done = totals.complete;
                  return (
                    <article key={match.id} className={`liga-board-card is-compact${done ? " is-done" : ""}`}>
                      <span className="liga-board-when mono">
                        {formatMatchWhen(match.startsAt) || "—"}
                      </span>
                      <strong className="liga-board-fixture-names">
                        {home} <span className="liga-board-vs">–</span> {away}
                      </strong>
                      {done ? (
                        <span className="liga-board-card-score mono">
                          {totals.homeMatch}:{totals.awayMatch}
                          <span className="liga-board-card-score-sub">
                            {" "}
                            · V {totals.homeBig}:{totals.awayBig} · K {totals.homePins}:{totals.awayPins}
                          </span>
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ResultsSlide({ state }: { state: LeagueState }) {
  const round = lastCompletedRound(state);
  const fixtures =
    round > 0
      ? state.matches
          .filter((m) => m.round === round && matchTotals(m, state.players).complete)
          .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
      : [];

  return (
    <div className="liga-board-slide is-results-detail">
      <div className="liga-board-results-bg" aria-hidden>
        <img src="/liga-board-results-bg.jpg" alt="" />
      </div>
      <div className="liga-board-results-veil" aria-hidden />
      <div className="liga-board-results-content">
        {fixtures.length === 0 ? (
          <div className="liga-board-empty-wrap">
            <p className="liga-board-empty">Še ni končanega kola.</p>
          </div>
        ) : (
          <div className="liga-board-result-grid is-3x2">
            {fixtures.map((match) => {
              const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
              const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
              const t = matchTotals(match, state.players);
              const homeWins = (t.homeMatch ?? 0) > (t.awayMatch ?? 0);
              const awayWins = (t.awayMatch ?? 0) > (t.homeMatch ?? 0);
              return (
                <article key={match.id} className="liga-board-result-card is-compact">
                  <p className="liga-board-result-when mono">
                    {formatMatchWhen(match.startsAt) || "—"}
                  </p>
                  <header className="liga-board-result-head">
                    <div className={`liga-board-result-team${homeWins ? " is-winner" : ""}`}>
                      <strong>{home}</strong>
                    </div>
                    <div className="liga-board-result-score mono">
                      <span className={homeWins ? "is-winner" : undefined}>{t.homeMatch}</span>
                      <span className="liga-board-result-sep">:</span>
                      <span className={awayWins ? "is-winner" : undefined}>{t.awayMatch}</span>
                    </div>
                    <div className={`liga-board-result-team is-away${awayWins ? " is-winner" : ""}`}>
                      <strong>{away}</strong>
                    </div>
                  </header>
                  <div className="liga-board-result-totals mono">
                    <span>
                      Velike <strong>{t.homeBig}:{t.awayBig}</strong>
                    </span>
                    <span>
                      Male <strong>{t.homeSmall}:{t.awaySmall}</strong>
                    </span>
                    <span>
                      Keglji <strong>{t.homePins}:{t.awayPins}</strong>
                    </span>
                  </div>
                  <div className="liga-board-result-rounds">
                    <div className="liga-board-result-round is-labels">
                      <span className="liga-board-result-round-num">Krog</span>
                      <span>Keglji</span>
                      <span>Velike</span>
                    </div>
                    {t.rounds.map((r, i) => (
                      <div key={i} className="liga-board-result-round">
                        <span className="liga-board-result-round-num">{i + 1}.</span>
                        <span className="mono is-pins">
                          {r.homePins}:{r.awayPins}
                        </span>
                        <span className="mono">
                          {r.homeBig}:{r.awayBig}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function slideTitle(id: SlideId, state: LeagueState, now: number): string {
  switch (id) {
    case "standings":
      return "Lestvica ekip";
    case "players":
      return "Lestvica igralcev";
    case "schedule": {
      const rounds = scheduleRoundsPair(state, now);
      if (rounds.length >= 2) return `Razpored ${rounds[0]}.–${rounds[1]}. kola`;
      if (rounds.length === 1) return `Razpored ${rounds[0]}. kola`;
      return "Razpored";
    }
    case "results": {
      const r = lastCompletedRound(state);
      return r > 0 ? `Rezultati ${r}. kola` : "Rezultati";
    }
    case "promo":
      return "V živo na spletu";
  }
}

function LeagueBoardScreen({ state }: { state: LeagueState }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active: fullscreen, toggle } = useFullscreen(rootRef);
  const [now, setNow] = useState(() => Date.now());
  const slides = useMemo(() => slideList(state, now), [state, now]);
  const slideKey = slides.join("|");
  const playerCount = useMemo(
    () => playersByAverage(computePlayerStandings(state)).length,
    [state],
  );
  const [index, setIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const safeIndex = slides.length ? index % slides.length : 0;
  const slide = slides[safeIndex] ?? "standings";
  const duration = slideDurationMs(slide, playerCount);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setProgressKey((k) => k + 1);
    }, duration);
    return () => window.clearTimeout(id);
  }, [slides.length, slideKey, slide, playerCount, duration, progressKey]);

  useEffect(() => {
    setIndex(0);
    setProgressKey((k) => k + 1);
  }, [slideKey]);

  const goTo = (i: number) => {
    setIndex(i);
    setProgressKey((k) => k + 1);
  };

  const season = leagueSeasonTitle(state);

  return (
    <div ref={rootRef} className={`liga-board${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="liga-board-glow" aria-hidden />
      <BoardHeader
        title={slideTitle(slide, state, now)}
        sub={season}
        fullscreen={fullscreen}
        onFullscreen={toggle}
      />
      <div key={`${slide}-${progressKey}`} className="liga-board-body is-fade">
        {slide === "standings" && <StandingsSlide state={state} />}
        {slide === "players" && <PlayersSlide state={state} active />}
        {slide === "schedule" && <ScheduleSlide state={state} now={now} />}
        {slide === "results" && <ResultsSlide state={state} />}
        {slide === "promo" && <PromoSlide />}
      </div>
      <div className="liga-board-nav">
        <div
          key={progressKey}
          className="liga-board-progress-bar"
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden
        />
        <div className="liga-board-dots" role="tablist" aria-label="Zasloni">
          {slides.map((id, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              className={`liga-board-dot${i === safeIndex ? " is-on" : ""}`}
              onClick={() => goTo(i)}
              title={SLIDE_LABEL[id]}
            >
              <span className="liga-board-dot-label">{SLIDE_LABEL[id]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** TV pregled lige: `?display=board` — lestvica, igralci, razpored, rezultati, promo. */
export function LeagueBoard() {
  const { state: storeState, remote } = useStore();
  const [polled, setPolled] = useState<LeagueState | null>(null);
  const [fromDb, setFromDb] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await fetchLeague();
        if (cancelled) return;
        if (payload.current?.data) {
          setPolled(payload.current.data);
          setFromDb(payload.storage === "db");
          setError(false);
        } else {
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
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  const state = fromDb && polled ? polled : (polled ?? storeState);
  const hasData = state.teams.length > 0 || state.matches.length > 0;

  if (booting && !hasData) {
    return (
      <div className="liga-board">
        <div className="liga-board-idle">
          <p>Nalaganje…</p>
        </div>
      </div>
    );
  }

  if (error && !hasData && !remote) {
    return (
      <div className="liga-board">
        <div className="liga-board-idle">
          <p>Ni povezave</p>
          <span>Poskusim znova samodejno.</span>
        </div>
      </div>
    );
  }

  return <LeagueBoardScreen state={state} />;
}
