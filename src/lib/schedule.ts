import { emptyRounds } from "./pairings";
import { uid } from "./ids";
import { inferSeasonKey, seasonCatalog, teamNamesMatchOfficial } from "./fixtures";
import { teamNamesMatch2025 } from "./fixtures2025";
import type { LeagueState, Match, Team } from "./types";

const BYE = "__bye__";

/** Krožni razpored. Liho število ekip: vsako kolo ena počiva. */
export function roundRobinPairings(teamIds: string[]): { homeId: string; awayId: string }[][] {
  const n = teamIds.length;
  if (n < 2) return [];
  const ids = n % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const rounds: { homeId: string; awayId: string }[][] = [];
  const count = ids.length;

  for (let r = 0; r < count - 1; r++) {
    const pairings: { homeId: string; awayId: string }[] = [];
    for (let i = 0; i < count / 2; i++) {
      const a = ids[i];
      const b = ids[count - 1 - i];
      if (a !== BYE && b !== BYE) {
        if (r % 2 === 0) pairings.push({ homeId: a, awayId: b });
        else pairings.push({ homeId: b, awayId: a });
      }
    }
    rounds.push(pairings);
    const last = ids.pop()!;
    ids.splice(1, 0, last);
  }
  return rounds;
}

function emptyMatch(
  round: number,
  homeTeamId: string,
  awayTeamId: string,
  startsAt?: string,
): Match {
  return {
    id: uid("m"),
    round,
    homeTeamId,
    awayTeamId,
    startsAt,
    homeStarters: ["", "", "", ""],
    awayStarters: ["", "", "", ""],
    homeBench: [],
    awayBench: [],
    rounds: emptyRounds(["", "", "", ""], ["", "", "", ""]),
    status: "scheduled",
  };
}

export function buildOfficialMatches(teams: Team[]): Match[] {
  const byName = new Map(teams.map((t) => [t.name, t.id]));
  const catalog = seasonCatalog(inferSeasonKey({ teams }));
  const matches: Match[] = [];
  for (const round of catalog.rounds) {
    for (const fixture of round.matches) {
      const homeId = byName.get(fixture.home);
      const awayId = byName.get(fixture.away);
      if (!homeId || !awayId) {
        throw new Error(`Manjka ekipa za tekmo ${fixture.home} — ${fixture.away}`);
      }
      matches.push(emptyMatch(round.round, homeId, awayId, fixture.startsAt));
    }
  }
  return matches;
}

export function buildRoundRobinMatches(teams: Team[]): Match[] {
  const rounds = roundRobinPairings(teams.map((t) => t.id));
  const matches: Match[] = [];
  rounds.forEach((pairings, index) => {
    for (const { homeId, awayId } of pairings) {
      matches.push(emptyMatch(index + 1, homeId, awayId));
    }
  });
  return matches;
}

export function buildSeasonMatches(teams: Team[]): Match[] {
  const names = teams.map((t) => t.name);
  if (teamNamesMatchOfficial(names) || teamNamesMatch2025(names)) {
    return buildOfficialMatches(teams);
  }
  return buildRoundRobinMatches(teams);
}

function teamIdByName(teams: Team[], name: string): string | undefined {
  const want = name.trim().replace(/\s+/g, " ").toUpperCase();
  return teams.find((t) => t.name.trim().replace(/\s+/g, " ").toUpperCase() === want)?.id;
}

export const SLOT_TIMES = ["18:00", "19:30", "21:00"] as const;

export function isoStart(date: string, time: string): string {
  const offset = date < "2025-10-26" || (date >= "2026-03-29" && date < "2026-10-25") || date >= "2027-03-28"
    ? "+02:00"
    : "+01:00";
  return `${date}T${time}:00${offset}`;
}

/** Razčleni ISO termin nazaj na YYYY-MM-DD in HH:MM (brez TZ premika). */
export function splitStartsAt(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: SLOT_TIMES[0] };
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return { date: m[1], time: m[2] };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: SLOT_TIMES[0] };
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${mo}-${day}`, time: `${hh}:${mm}` };
}

function parseDate(raw: string): string | null {
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const si = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!si) return null;
  return `${si[3]}-${si[2].padStart(2, "0")}-${si[1].padStart(2, "0")}`;
}

function parseTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export type FixtureRow = {
  round: number;
  home: string;
  away: string;
  startsAt?: string;
  note?: string;
};

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === delim && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseScheduleCsv(text: string): { rows: FixtureRow[]; error?: string } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], error: "Datoteka je prazna." };
  const delim = lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], delim).map((c) => c.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iRound = col(["kolo", "round"]);
  const iHome = col(["doma", "home"]);
  const iAway = col(["gost", "away"]);
  const iDate = col(["datum", "date"]);
  const iTime = col(["ura", "time", "cas", "čas"]);
  const iNote = col(["opomba", "note", "pavza", "pocitnic", "počitnic"]);
  if (iRound < 0) {
    return { rows: [], error: "V prvi vrstici potrebuješ stolpec kolo. Za tekme še domači in gostje, za pavzo stolpec opomba." };
  }
  const start = header.some((h) => /kolo|round|doma|opomba/.test(h)) ? 1 : 0;
  const rows: FixtureRow[] = [];
  for (const line of lines.slice(start)) {
    const cells = splitCsvLine(line, delim);
    const round = Number(cells[iRound]);
    const home = iHome >= 0 ? (cells[iHome] ?? "") : "";
    const away = iAway >= 0 ? (cells[iAway] ?? "") : "";
    const note = iNote >= 0 ? (cells[iNote] ?? "") : "";
    if (!Number.isInteger(round) || round < 1) continue;
    const date = iDate >= 0 ? parseDate(cells[iDate] ?? "") : null;
    const time = iTime >= 0 ? parseTime(cells[iTime] ?? "") : null;
    if (!home && !away && !note) continue;
    rows.push({
      round,
      home,
      away,
      note: note || undefined,
      startsAt: date && time ? isoStart(date, time) : undefined,
    });
  }
  if (rows.length === 0) return { rows: [], error: "V datoteki ni veljavnih tekem ali opomb." };
  return { rows };
}

export function remainingOfficialRounds(state: { seasonKey?: LeagueState["seasonKey"]; teams: Team[]; matches: Match[] }): number {
  const catalog = seasonCatalog(inferSeasonKey(state));
  const maxRound = Math.max(0, ...state.matches.map((m) => m.round));
  return catalog.rounds.filter((r) => r.round > maxRound).length;
}

export function appendOfficialRemaining(state: LeagueState): LeagueState {
  const catalog = seasonCatalog(inferSeasonKey(state));
  const maxRound = Math.max(0, ...state.matches.map((m) => m.round));
  const extra = catalog.rounds.filter((r) => r.round > maxRound);
  if (extra.length === 0) return state;
  const byName = new Map(state.teams.map((t) => [t.name, t.id]));
  const added: Match[] = [];
  for (const round of extra) {
    for (const fixture of round.matches) {
      const homeId = byName.get(fixture.home);
      const awayId = byName.get(fixture.away);
      if (!homeId || !awayId) {
        throw new Error(`Manjka ekipa za tekmo ${fixture.home} — ${fixture.away}`);
      }
      added.push(emptyMatch(round.round, homeId, awayId, fixture.startsAt));
    }
  }
  return { ...state, matches: [...state.matches, ...added] };
}

export function appendFixtureRows(state: LeagueState, rows: FixtureRow[]): LeagueState {
  const existing = new Set(
    state.matches.map((m) => `${m.round}|${m.homeTeamId}|${m.awayTeamId}`),
  );
  const added: Match[] = [];
  const missing: string[] = [];
  const notes = { ...(state.roundNotes ?? {}) };
  for (const row of rows) {
    if (row.note) notes[String(row.round)] = row.note;
    if (!row.home && !row.away) continue;
    const homeId = teamIdByName(state.teams, row.home);
    const awayId = teamIdByName(state.teams, row.away);
    if (!homeId) missing.push(row.home);
    if (!awayId) missing.push(row.away);
    if (!homeId || !awayId) continue;
    const key = `${row.round}|${homeId}|${awayId}`;
    if (existing.has(key)) continue;
    existing.add(key);
    added.push(emptyMatch(row.round, homeId, awayId, row.startsAt));
  }
  if (missing.length) {
    throw new Error(`Neznane ekipe: ${[...new Set(missing)].join(", ")}`);
  }
  const nextNotes = Object.keys(notes).length ? notes : state.roundNotes;
  if (added.length === 0 && nextNotes === state.roundNotes) return state;
  return { ...state, matches: [...state.matches, ...added], roundNotes: nextNotes };
}

const MONTHS_SI = [
  "januar",
  "februar",
  "marec",
  "april",
  "maj",
  "junij",
  "julij",
  "avgust",
  "september",
  "oktober",
  "november",
  "december",
];

function parseYmd(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromYmd(iso: string): Date {
  const { y, m, d } = parseYmd(iso);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, days: number): string {
  const date = fromYmd(iso);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

export function mondayOf(iso: string): string {
  const date = fromYmd(iso);
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  return toYmd(date);
}

export type CalendarPlan = {
  matchDays: string[];
  holidayWeeks: string[][];
};

/** Teden, kjer so označeni pon.–pet., je počitniški in ni igralni. */
export function splitCalendarDates(dates: string[]): CalendarPlan {
  const set = new Set(dates);
  const mondays = new Set(dates.map(mondayOf));
  const holidayWeeks: string[][] = [];
  const holidayMons = new Set<string>();
  for (const monday of [...mondays].sort()) {
    const workdays = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
    if (workdays.every((day) => set.has(day))) {
      holidayWeeks.push(workdays);
      holidayMons.add(monday);
    }
  }
  return {
    matchDays: [...dates].filter((day) => !holidayMons.has(mondayOf(day))).sort(),
    holidayWeeks,
  };
}

function holidayNotes(roundDays: string[][], holidayWeeks: string[][], startRound: number): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const week of holidayWeeks) {
    const start = week[0];
    let round = startRound;
    for (let i = 0; i < roundDays.length; i++) {
      const last = roundDays[i][roundDays[i].length - 1];
      if (last && last < start) round = startRound + i;
    }
    const text = `${formatDateRange(week)} — počitnice (liga se ne igra)`;
    notes[String(round)] = notes[String(round)] ? `${notes[String(round)]}; ${text}` : text;
  }
  return notes;
}

export function formatDateRange(dates: string[]): string {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return "";
  const a = parseYmd(sorted[0]);
  const b = parseYmd(sorted[sorted.length - 1]);
  if (sorted.length === 1 || sorted[0] === sorted[sorted.length - 1]) {
    return `${a.d}. ${MONTHS_SI[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y && a.m === b.m) {
    return `${a.d}.–${b.d}. ${MONTHS_SI[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) {
    return `${a.d}. ${MONTHS_SI[a.m - 1]} – ${b.d}. ${MONTHS_SI[b.m - 1]} ${a.y}`;
  }
  return `${a.d}. ${MONTHS_SI[a.m - 1]} ${a.y} – ${b.d}. ${MONTHS_SI[b.m - 1]} ${b.y}`;
}

export function matchesPerRound(teamCount: number): number {
  return Math.floor(teamCount / 2);
}

export function daysNeededPerRound(teamCount: number): number {
  return Math.max(1, Math.ceil(matchesPerRound(teamCount) / SLOT_TIMES.length));
}

/** Eno kroženje: vsak z vsakim enkrat. */
export function halfRoundCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount;
}

export function daysNeededForHalf(teamCount: number): number {
  return halfRoundCount(teamCount) * daysNeededPerRound(teamCount);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixOrder<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function slotted(
  pairs: { homeId: string; awayId: string }[],
  days: string[],
): { homeId: string; awayId: string; startsAt: string }[] {
  return pairs.map((pair, index) => {
    const day = days[Math.min(Math.floor(index / SLOT_TIMES.length), days.length - 1)];
    const time = SLOT_TIMES[index % SLOT_TIMES.length];
    return { ...pair, startsAt: isoStart(day, time) };
  });
}

export function buildDrawMatches(teams: Team[], dates: string[]): {
  matches: Match[];
  roundLabels: Record<string, string>;
  roundNotes: Record<string, string>;
} {
  const pairings = roundRobinPairings(teams.map((t) => t.id));
  const daysPer = daysNeededPerRound(teams.length);
  const { matchDays, holidayWeeks } = splitCalendarDates(dates);
  const needed = pairings.length * daysPer;
  if (matchDays.length < needed) {
    throw new Error(`Izberi ${needed} igralnih dni za ${pairings.length} krogov (počitniški teden = pon.–pet.).`);
  }
  const matches: Match[] = [];
  const roundLabels: Record<string, string> = {};
  const roundDays: string[][] = [];
  pairings.forEach((pairs, index) => {
    const days = matchDays.slice(index * daysPer, (index + 1) * daysPer);
    roundDays.push(days);
    roundLabels[String(index + 1)] = formatDateRange(days);
    for (const slot of slotted(pairs, days)) {
      matches.push(emptyMatch(index + 1, slot.homeId, slot.awayId, slot.startsAt));
    }
  });
  return { matches, roundLabels, roundNotes: holidayNotes(roundDays, holidayWeeks, 1) };
}

export function firstHalfComplete(state: LeagueState): boolean {
  if (state.matches.length === 0) return false;
  const half = halfRoundCount(state.teams.length);
  const rounds = new Set(state.matches.map((m) => m.round));
  const maxRound = Math.max(0, ...rounds);
  return maxRound === half && rounds.size === half;
}

export function buildReturnDraw(state: LeagueState, dates: string[]): {
  matches: Match[];
  roundLabels: Record<string, string>;
  roundNotes: Record<string, string>;
} {
  const half = halfRoundCount(state.teams.length);
  const daysPer = daysNeededPerRound(state.teams.length);
  const { matchDays, holidayWeeks } = splitCalendarDates(dates);
  const needed = half * daysPer;
  if (matchDays.length < needed) {
    throw new Error(`Izberi ${needed} igralnih dni za 2. del (${half} krogov).`);
  }
  const byRound = new Map<number, Match[]>();
  for (const match of state.matches) {
    if (match.round > half) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  const added: Match[] = [];
  const roundLabels = { ...(state.roundLabels ?? {}) };
  const roundDays: string[][] = [];
  for (let r = 1; r <= half; r++) {
    const first = (byRound.get(r) ?? []).sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
    const reversed = first.map((m) => ({ homeId: m.awayTeamId, awayId: m.homeTeamId }));
    const mixed = mixOrder(reversed, r * 1009 + state.teams.length);
    const days = matchDays.slice((r - 1) * daysPer, r * daysPer);
    roundDays.push(days);
    const round = half + r;
    roundLabels[String(round)] = formatDateRange(days);
    for (const slot of slotted(mixed, days)) {
      added.push(emptyMatch(round, slot.homeId, slot.awayId, slot.startsAt));
    }
  }
  return {
    matches: [...state.matches, ...added],
    roundLabels,
    roundNotes: { ...(state.roundNotes ?? {}), ...holidayNotes(roundDays, holidayWeeks, half + 1) },
  };
}

export function byeTeamName(round: number, teams: Team[], matches: Match[]): string | undefined {
  const playing = new Set(
    matches
      .filter((m) => m.round === round)
      .flatMap((m) => [m.homeTeamId, m.awayTeamId]),
  );
  return teams.find((t) => !playing.has(t.id))?.name;
}
