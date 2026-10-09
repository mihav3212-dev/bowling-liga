import { ROUNDS_2025, SEASON_TITLE_2025, teamNamesMatch2025 } from "./fixtures2025";
import type { LeagueState } from "./types";

/** Uradni razpored Bowling liga 2026/2027 (13 ekip, 13 krogov). */

export const SEASON_TITLE = "2026/2027";

export const SEASON_TEAM_NAMES = [
  "STREHE RANER",
  "FRIZERSTVO SIJAJ",
  "POŽARNI INŽINERING MURŠEC",
  "OBČINA LENART",
  "PIVOVARNA VARDAM",
  "KLASMETAL",
  "SAUBERMACHER",
  "BAR 10",
  "BOWLING LENART",
  "N & N SAUNE 2",
  "N & N SAUNE 1",
  "DREAM GYM",
  "MOBICOM",
] as const;

export type OfficialRound = {
  round: number;
  label: string;
  bye?: string;
  noteAfter?: string;
  matches: { home: string; away: string; startsAt: string }[];
};

/** Zadnja nedelja oktobra 2026 (25. 10.) — prehod na CET. */
function at(date: string, time: string): string {
  const offset = date < "2026-10-25" ? "+02:00" : "+01:00";
  return `${date}T${time}:00${offset}`;
}

function slot(
  home: string,
  away: string,
  date: string,
  time: "18:00" | "19:30" | "21:00",
): OfficialRound["matches"][number] {
  return { home, away, startsAt: at(date, time) };
}

export const OFFICIAL_ROUNDS: OfficialRound[] = [
  {
    round: 1,
    label: "14.–15. oktober 2026",
    bye: "STREHE RANER",
    matches: [
      slot("OBČINA LENART", "N & N SAUNE 1", "2026-10-14", "18:00"),
      slot("KLASMETAL", "BOWLING LENART", "2026-10-14", "19:30"),
      slot("FRIZERSTVO SIJAJ", "MOBICOM", "2026-10-14", "21:00"),
      slot("POŽARNI INŽINERING MURŠEC", "DREAM GYM", "2026-10-15", "18:00"),
      slot("SAUBERMACHER", "BAR 10", "2026-10-15", "19:30"),
      slot("PIVOVARNA VARDAM", "N & N SAUNE 2", "2026-10-15", "21:00"),
    ],
  },
  {
    round: 2,
    label: "21.–22. oktober 2026",
    bye: "DREAM GYM",
    noteAfter: "28.–29. oktober 2026 — prost teden (liga se ne igra)",
    matches: [
      slot("KLASMETAL", "SAUBERMACHER", "2026-10-21", "18:00"),
      slot("PIVOVARNA VARDAM", "BAR 10", "2026-10-21", "19:30"),
      slot("POŽARNI INŽINERING MURŠEC", "N & N SAUNE 2", "2026-10-21", "21:00"),
      slot("STREHE RANER", "MOBICOM", "2026-10-22", "18:00"),
      slot("FRIZERSTVO SIJAJ", "N & N SAUNE 1", "2026-10-22", "19:30"),
      slot("OBČINA LENART", "BOWLING LENART", "2026-10-22", "21:00"),
    ],
  },
  {
    round: 3,
    label: "4.–5. november 2026",
    bye: "N & N SAUNE 2",
    matches: [
      slot("STREHE RANER", "DREAM GYM", "2026-11-04", "18:00"),
      slot("OBČINA LENART", "SAUBERMACHER", "2026-11-04", "19:30"),
      slot("MOBICOM", "N & N SAUNE 1", "2026-11-04", "21:00"),
      slot("FRIZERSTVO SIJAJ", "BOWLING LENART", "2026-11-05", "18:00"),
      slot("PIVOVARNA VARDAM", "KLASMETAL", "2026-11-05", "19:30"),
      slot("POŽARNI INŽINERING MURŠEC", "BAR 10", "2026-11-05", "21:00"),
    ],
  },
  {
    round: 4,
    label: "11.–12. november 2026",
    bye: "BAR 10",
    matches: [
      slot("MOBICOM", "BOWLING LENART", "2026-11-11", "18:00"),
      slot("DREAM GYM", "N & N SAUNE 2", "2026-11-11", "19:30"),
      slot("POŽARNI INŽINERING MURŠEC", "KLASMETAL", "2026-11-11", "21:00"),
      slot("OBČINA LENART", "PIVOVARNA VARDAM", "2026-11-12", "18:00"),
      slot("STREHE RANER", "N & N SAUNE 1", "2026-11-12", "19:30"),
      slot("FRIZERSTVO SIJAJ", "SAUBERMACHER", "2026-11-12", "21:00"),
    ],
  },
  {
    round: 5,
    label: "18.–19. november 2026",
    bye: "KLASMETAL",
    matches: [
      slot("FRIZERSTVO SIJAJ", "PIVOVARNA VARDAM", "2026-11-18", "18:00"),
      slot("MOBICOM", "SAUBERMACHER", "2026-11-18", "19:30"),
      slot("DREAM GYM", "BAR 10", "2026-11-18", "21:00"),
      slot("N & N SAUNE 1", "BOWLING LENART", "2026-11-19", "18:00"),
      slot("POŽARNI INŽINERING MURŠEC", "OBČINA LENART", "2026-11-19", "19:30"),
      slot("STREHE RANER", "N & N SAUNE 2", "2026-11-19", "21:00"),
    ],
  },
  {
    round: 6,
    label: "25.–26. november 2026",
    bye: "OBČINA LENART",
    matches: [
      slot("N & N SAUNE 2", "BAR 10", "2026-11-25", "18:00"),
      slot("FRIZERSTVO SIJAJ", "POŽARNI INŽINERING MURŠEC", "2026-11-25", "19:30"),
      slot("STREHE RANER", "BOWLING LENART", "2026-11-25", "21:00"),
      slot("DREAM GYM", "KLASMETAL", "2026-11-26", "18:00"),
      slot("MOBICOM", "PIVOVARNA VARDAM", "2026-11-26", "19:30"),
      slot("N & N SAUNE 1", "SAUBERMACHER", "2026-11-26", "21:00"),
    ],
  },
  {
    round: 7,
    label: "2.–3. december 2026",
    bye: "FRIZERSTVO SIJAJ",
    matches: [
      slot("BOWLING LENART", "SAUBERMACHER", "2026-12-02", "18:00"),
      slot("N & N SAUNE 1", "PIVOVARNA VARDAM", "2026-12-02", "19:30"),
      slot("DREAM GYM", "OBČINA LENART", "2026-12-02", "21:00"),
      slot("STREHE RANER", "BAR 10", "2026-12-03", "18:00"),
      slot("N & N SAUNE 2", "KLASMETAL", "2026-12-03", "19:30"),
      slot("MOBICOM", "POŽARNI INŽINERING MURŠEC", "2026-12-03", "21:00"),
    ],
  },
  {
    round: 8,
    label: "9.–10. december 2026",
    bye: "MOBICOM",
    matches: [
      slot("N & N SAUNE 1", "POŽARNI INŽINERING MURŠEC", "2026-12-09", "18:00"),
      slot("BAR 10", "KLASMETAL", "2026-12-09", "19:30"),
      slot("STREHE RANER", "SAUBERMACHER", "2026-12-09", "21:00"),
      slot("N & N SAUNE 2", "OBČINA LENART", "2026-12-10", "18:00"),
      slot("DREAM GYM", "FRIZERSTVO SIJAJ", "2026-12-10", "19:30"),
      slot("BOWLING LENART", "PIVOVARNA VARDAM", "2026-12-10", "21:00"),
    ],
  },
  {
    round: 9,
    label: "16.–17. december 2026",
    bye: "N & N SAUNE 1",
    noteAfter: "Božično-novoletna pavza — nadaljevanje v sredo, 13. januarja 2027",
    matches: [
      slot("DREAM GYM", "MOBICOM", "2026-12-16", "18:00"),
      slot("N & N SAUNE 2", "FRIZERSTVO SIJAJ", "2026-12-16", "19:30"),
      slot("BAR 10", "OBČINA LENART", "2026-12-16", "21:00"),
      slot("SAUBERMACHER", "PIVOVARNA VARDAM", "2026-12-17", "18:00"),
      slot("BOWLING LENART", "POŽARNI INŽINERING MURŠEC", "2026-12-17", "19:30"),
      slot("STREHE RANER", "KLASMETAL", "2026-12-17", "21:00"),
    ],
  },
  {
    round: 10,
    label: "13.–14. januar 2027",
    bye: "BOWLING LENART",
    matches: [
      slot("KLASMETAL", "OBČINA LENART", "2027-01-13", "18:00"),
      slot("STREHE RANER", "PIVOVARNA VARDAM", "2027-01-13", "19:30"),
      slot("SAUBERMACHER", "POŽARNI INŽINERING MURŠEC", "2027-01-13", "21:00"),
      slot("BAR 10", "FRIZERSTVO SIJAJ", "2027-01-14", "18:00"),
      slot("N & N SAUNE 2", "MOBICOM", "2027-01-14", "19:30"),
      slot("N & N SAUNE 1", "DREAM GYM", "2027-01-14", "21:00"),
    ],
  },
  {
    round: 11,
    label: "20.–21. januar 2027",
    bye: "SAUBERMACHER",
    matches: [
      slot("PIVOVARNA VARDAM", "POŽARNI INŽINERING MURŠEC", "2027-01-20", "18:00"),
      slot("BOWLING LENART", "DREAM GYM", "2027-01-20", "19:30"),
      slot("KLASMETAL", "FRIZERSTVO SIJAJ", "2027-01-20", "21:00"),
      slot("N & N SAUNE 2", "N & N SAUNE 1", "2027-01-21", "18:00"),
      slot("STREHE RANER", "OBČINA LENART", "2027-01-21", "19:30"),
      slot("BAR 10", "MOBICOM", "2027-01-21", "21:00"),
    ],
  },
  {
    round: 12,
    label: "27.–28. januar 2027",
    bye: "PIVOVARNA VARDAM",
    matches: [
      slot("BAR 10", "N & N SAUNE 1", "2027-01-27", "18:00"),
      slot("STREHE RANER", "POŽARNI INŽINERING MURŠEC", "2027-01-27", "19:30"),
      slot("BOWLING LENART", "N & N SAUNE 2", "2027-01-27", "21:00"),
      slot("KLASMETAL", "MOBICOM", "2027-01-28", "18:00"),
      slot("SAUBERMACHER", "DREAM GYM", "2027-01-28", "19:30"),
      slot("OBČINA LENART", "FRIZERSTVO SIJAJ", "2027-01-28", "21:00"),
    ],
  },
  {
    round: 13,
    label: "3.–4. februar 2027",
    bye: "POŽARNI INŽINERING MURŠEC",
    matches: [
      slot("STREHE RANER", "FRIZERSTVO SIJAJ", "2027-02-03", "18:00"),
      slot("OBČINA LENART", "MOBICOM", "2027-02-03", "19:30"),
      slot("PIVOVARNA VARDAM", "DREAM GYM", "2027-02-03", "21:00"),
      slot("SAUBERMACHER", "N & N SAUNE 2", "2027-02-04", "18:00"),
      slot("BAR 10", "BOWLING LENART", "2027-02-04", "19:30"),
      slot("KLASMETAL", "N & N SAUNE 1", "2027-02-04", "21:00"),
    ],
  },
];

export type SeasonKey = "2026-27" | "2025-26";

export function inferSeasonKey(state: Pick<LeagueState, "seasonKey" | "teams">): SeasonKey {
  if (state.seasonKey === "2025-26" || state.seasonKey === "2026-27") return state.seasonKey;
  if (teamNamesMatch2025(state.teams.map((t) => t.name))) return "2025-26";
  return "2026-27";
}

export function seasonCatalog(key: SeasonKey) {
  if (key === "2025-26") {
    return {
      title: SEASON_TITLE_2025,
      rounds: ROUNDS_2025,
      intro:
        "Sezona 2025/2026 · sreda in četrtek ob 18:00, 19:30 in 21:00 · 12 ekip, 11 krogov.",
    };
  }
  return {
    title: SEASON_TITLE,
    rounds: OFFICIAL_ROUNDS,
    intro:
      "Sezona 2026/2027 · sreda in četrtek ob 18:00, 19:30 in 21:00 · vsako kolo ena ekipa počiva.",
  };
}

export function officialRoundMeta(
  round: number,
  seasonKey?: SeasonKey,
): OfficialRound | undefined {
  const rounds = seasonKey === "2025-26" ? ROUNDS_2025 : OFFICIAL_ROUNDS;
  return rounds.find((r) => r.round === round);
}

export function teamNamesMatchOfficial(names: string[]): boolean {
  if (names.length !== SEASON_TEAM_NAMES.length) return false;
  const have = new Set(names);
  return SEASON_TEAM_NAMES.every((name) => have.has(name));
}

export function leagueSeasonTitle(state: Pick<LeagueState, "seasonKey" | "seasonTitle" | "teams">): string {
  return state.seasonTitle ?? seasonCatalog(inferSeasonKey(state)).title;
}
