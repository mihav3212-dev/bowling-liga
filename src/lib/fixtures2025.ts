import type { OfficialRound } from "./fixtures";

/** Uradni razpored 2025/2026 (12 ekip, 11 krogov, 1. krog). */

export const SEASON_TITLE_2025 = "2025/2026";

export const SEASON_TEAM_NAMES_2025 = [
  "PIVOVARNA VARDAM",
  "PARMA",
  "KLASMETAL",
  "BAR 10",
  "MOBICOM",
  "SAUBERMACHER",
  "OBČINA LENART",
  "BELI LABOD",
  "POŽARNI INŽENIRING MURŠEC",
  "BOWLING LENART",
  "FITNES LENART",
  "FRIZERSTVO SIJAJ",
] as const;

/** Zadnja nedelja oktobra 2025 (26. 10.) — prehod na CET. */
function at(date: string, time: string): string {
  const offset = date < "2025-10-26" ? "+02:00" : "+01:00";
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

/**
 * Četrtek 6. 11. 2025: na PDF sta pri 18:00 in 19:30 obakrat navedena MOBICOM
 * (manjka FRIZERSTVO SIJAJ). Vzeta sta para KLASMETAL–FRIZERSTVO SIJAJ in
 * MOBICOM–BAR 10, da ima vsaka ekipa v kolu eno tekmo in da se para ne ponovita
 * v poznejših krogih.
 */
export const ROUNDS_2025: OfficialRound[] = [
  {
    round: 1,
    label: "15.–16. oktober 2025",
    matches: [
      slot("PIVOVARNA VARDAM", "PARMA", "2025-10-15", "18:00"),
      slot("KLASMETAL", "BAR 10", "2025-10-15", "19:30"),
      slot("MOBICOM", "SAUBERMACHER", "2025-10-15", "21:00"),
      slot("OBČINA LENART", "BELI LABOD", "2025-10-16", "18:00"),
      slot("POŽARNI INŽENIRING MURŠEC", "BOWLING LENART", "2025-10-16", "19:30"),
      slot("FITNES LENART", "FRIZERSTVO SIJAJ", "2025-10-16", "21:00"),
    ],
  },
  {
    round: 2,
    label: "22.–23. oktober 2025",
    noteAfter: "29.–30. oktober 2025 — ni lige (šolske počitnice)",
    matches: [
      slot("SAUBERMACHER", "POŽARNI INŽENIRING MURŠEC", "2025-10-22", "18:00"),
      slot("BAR 10", "OBČINA LENART", "2025-10-22", "19:30"),
      slot("BOWLING LENART", "FITNES LENART", "2025-10-22", "21:00"),
      slot("FRIZERSTVO SIJAJ", "PIVOVARNA VARDAM", "2025-10-23", "18:00"),
      slot("BELI LABOD", "MOBICOM", "2025-10-23", "19:30"),
      slot("PARMA", "KLASMETAL", "2025-10-23", "21:00"),
    ],
  },
  {
    round: 3,
    label: "5.–6. november 2025",
    matches: [
      slot("PIVOVARNA VARDAM", "FITNES LENART", "2025-11-05", "18:00"),
      slot("BOWLING LENART", "SAUBERMACHER", "2025-11-05", "19:30"),
      slot("OBČINA LENART", "PARMA", "2025-11-05", "21:00"),
      slot("KLASMETAL", "FRIZERSTVO SIJAJ", "2025-11-06", "18:00"),
      slot("MOBICOM", "BAR 10", "2025-11-06", "19:30"),
      slot("POŽARNI INŽENIRING MURŠEC", "BELI LABOD", "2025-11-06", "21:00"),
    ],
  },
  {
    round: 4,
    label: "12.–13. november 2025",
    matches: [
      slot("FITNES LENART", "SAUBERMACHER", "2025-11-12", "18:00"),
      slot("FRIZERSTVO SIJAJ", "OBČINA LENART", "2025-11-12", "19:30"),
      slot("BAR 10", "POŽARNI INŽENIRING MURŠEC", "2025-11-12", "21:00"),
      slot("PARMA", "MOBICOM", "2025-11-13", "18:00"),
      slot("BELI LABOD", "BOWLING LENART", "2025-11-13", "19:30"),
      slot("PIVOVARNA VARDAM", "KLASMETAL", "2025-11-13", "21:00"),
    ],
  },
  {
    round: 5,
    label: "19.–20. november 2025",
    matches: [
      slot("OBČINA LENART", "PIVOVARNA VARDAM", "2025-11-19", "18:00"),
      slot("KLASMETAL", "FITNES LENART", "2025-11-19", "19:30"),
      slot("SAUBERMACHER", "BELI LABOD", "2025-11-19", "21:00"),
      slot("BOWLING LENART", "BAR 10", "2025-11-20", "18:00"),
      slot("POŽARNI INŽENIRING MURŠEC", "PARMA", "2025-11-20", "19:30"),
      slot("MOBICOM", "FRIZERSTVO SIJAJ", "2025-11-20", "21:00"),
    ],
  },
  {
    round: 6,
    label: "26.–27. november 2025",
    matches: [
      slot("BAR 10", "SAUBERMACHER", "2025-11-26", "18:00"),
      slot("KLASMETAL", "OBČINA LENART", "2025-11-26", "19:30"),
      slot("PARMA", "BOWLING LENART", "2025-11-26", "21:00"),
      slot("FRIZERSTVO SIJAJ", "POŽARNI INŽENIRING MURŠEC", "2025-11-27", "18:00"),
      slot("FITNES LENART", "BELI LABOD", "2025-11-27", "19:30"),
      slot("PIVOVARNA VARDAM", "MOBICOM", "2025-11-27", "21:00"),
    ],
  },
  {
    round: 7,
    label: "3.–4. december 2025",
    noteAfter: "Božično-novoletni premor do 14. januarja 2026",
    matches: [
      slot("POŽARNI INŽENIRING MURŠEC", "PIVOVARNA VARDAM", "2025-12-03", "18:00"),
      slot("SAUBERMACHER", "PARMA", "2025-12-03", "19:30"),
      slot("BOWLING LENART", "FRIZERSTVO SIJAJ", "2025-12-03", "21:00"),
      slot("MOBICOM", "KLASMETAL", "2025-12-04", "18:00"),
      slot("BELI LABOD", "BAR 10", "2025-12-04", "19:30"),
      slot("OBČINA LENART", "FITNES LENART", "2025-12-04", "21:00"),
    ],
  },
  {
    round: 8,
    label: "14.–15. januar 2026",
    matches: [
      slot("FITNES LENART", "BAR 10", "2026-01-14", "18:00"),
      slot("FRIZERSTVO SIJAJ", "SAUBERMACHER", "2026-01-14", "19:30"),
      slot("PIVOVARNA VARDAM", "BOWLING LENART", "2026-01-14", "21:00"),
      slot("PARMA", "BELI LABOD", "2026-01-15", "18:00"),
      slot("KLASMETAL", "POŽARNI INŽENIRING MURŠEC", "2026-01-15", "19:30"),
      slot("OBČINA LENART", "MOBICOM", "2026-01-15", "21:00"),
    ],
  },
  {
    round: 9,
    label: "21.–22. januar 2026",
    matches: [
      slot("MOBICOM", "FITNES LENART", "2026-01-21", "18:00"),
      slot("BAR 10", "PARMA", "2026-01-21", "19:30"),
      slot("SAUBERMACHER", "PIVOVARNA VARDAM", "2026-01-21", "21:00"),
      slot("POŽARNI INŽENIRING MURŠEC", "OBČINA LENART", "2026-01-22", "18:00"),
      slot("BOWLING LENART", "KLASMETAL", "2026-01-22", "19:30"),
      slot("BELI LABOD", "FRIZERSTVO SIJAJ", "2026-01-22", "21:00"),
    ],
  },
  {
    round: 10,
    label: "28.–29. januar 2026",
    matches: [
      slot("MOBICOM", "POŽARNI INŽENIRING MURŠEC", "2026-01-28", "18:00"),
      slot("KLASMETAL", "SAUBERMACHER", "2026-01-28", "19:30"),
      slot("OBČINA LENART", "BOWLING LENART", "2026-01-28", "21:00"),
      slot("PIVOVARNA VARDAM", "BELI LABOD", "2026-01-29", "18:00"),
      slot("FRIZERSTVO SIJAJ", "BAR 10", "2026-01-29", "19:30"),
      slot("FITNES LENART", "PARMA", "2026-01-29", "21:00"),
    ],
  },
  {
    round: 11,
    label: "4.–5. februar 2026",
    matches: [
      slot("SAUBERMACHER", "OBČINA LENART", "2026-02-04", "18:00"),
      slot("POŽARNI INŽENIRING MURŠEC", "FITNES LENART", "2026-02-04", "19:30"),
      slot("PARMA", "FRIZERSTVO SIJAJ", "2026-02-04", "21:00"),
      slot("BELI LABOD", "KLASMETAL", "2026-02-05", "18:00"),
      slot("BOWLING LENART", "MOBICOM", "2026-02-05", "19:30"),
      slot("BAR 10", "PIVOVARNA VARDAM", "2026-02-05", "21:00"),
    ],
  },
];

export function teamNamesMatch2025(names: string[]): boolean {
  if (names.length !== SEASON_TEAM_NAMES_2025.length) return false;
  const have = new Set(names);
  return SEASON_TEAM_NAMES_2025.every((name) => have.has(name));
}
