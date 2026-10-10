import { useMemo, useState } from "react";
import { mondayOf, splitCalendarDates } from "../lib/schedule";

const WEEKDAYS = ["pon", "tor", "sre", "čet", "pet", "sob", "ned"];
const MONTHS = [
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

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: start }, () => null);
  for (let d = 1; d <= days; d++) cells.push(ymd(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DayPicker({
  title,
  needed,
  rounds,
  daysPerRound,
  returnHalf,
  onConfirm,
  onCancel,
}: {
  title: string;
  needed: number;
  rounds: number;
  daysPerRound: number;
  returnHalf?: boolean;
  onConfirm: (dates: string[]) => void;
  onCancel: () => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<string[]>([]);
  const selected = useMemo(() => new Set(picked), [picked]);
  const plan = useMemo(() => splitCalendarDates(picked), [picked]);
  const holidayMons = useMemo(
    () => new Set(plan.holidayWeeks.map((week) => mondayOf(week[0]))),
    [plan.holidayWeeks],
  );
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth());
  const ready = plan.matchDays.length >= needed;
  const extra =
    plan.matchDays.length > needed ? ` Uporabim prvih ${needed} igralnih dni po datumu.` : "";

  const toggle = (iso: string) => {
    setPicked((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()));
  };

  return (
    <div className="calendar-overlay" role="dialog" aria-modal="true" aria-labelledby="cal-title">
      <div className="calendar-panel">
        <h3 id="cal-title">{title}</h3>
        <ol className="calendar-help">
          <li>
            Za vsako kolo označi <strong>igralne dni</strong> (ponavadi <strong>sreda in četrtek</strong>).
            Potrebuješ <strong>{needed}</strong> igralnih dni za <strong>{rounds}</strong> krogov
            {daysPerRound > 1 ? ` (po ${daysPerRound} dni na kolo)` : ""}.
          </li>
          <li>
            Termini so <strong>18:00, 19:30 in 21:00</strong>, tri tekme na dan.
          </li>
          <li>
            Če v istem tednu označiš <strong>ponedeljek do petka</strong>, je to{" "}
            <strong>počitniški teden</strong> — liga tisti teden ne igra, na razporedu se izpiše pavza.
          </li>
          {returnHalf ? (
            <li>
              V 2. delu se <strong>domačin in gost zamenjata</strong>, igralni dan in ura pa se malo premešata.
            </li>
          ) : (
            <li>Ko je 1. del v razporedu, lahko kasneje isto narediš za 2. del.</li>
          )}
        </ol>
        <p className="muted">
          Igralnih dni: {plan.matchDays.length} / {needed}
          {plan.holidayWeeks.length > 0 ? ` · počitniški tedni: ${plan.holidayWeeks.length}` : ""}.
          {extra}
        </p>
        <div className="calendar-nav">
          <button className="ghost" type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            ←
          </button>
          <strong>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </strong>
          <button className="ghost" type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            →
          </button>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((day) => (
            <span key={day} className="calendar-dow">
              {day}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                type="button"
                className={`calendar-day${selected.has(iso) ? " is-on" : ""}${
                  holidayMons.has(mondayOf(iso)) && selected.has(iso) ? " is-holiday" : ""
                }`}
                onClick={() => toggle(iso)}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <span key={`e-${i}`} />
            ),
          )}
        </div>
        <div className="row-actions">
          <button className="ghost" type="button" onClick={onCancel}>
            Prekliči
          </button>
          <button className="primary" type="button" disabled={!ready} onClick={() => onConfirm([...picked].sort())}>
            Naredi žreb
          </button>
        </div>
      </div>
    </div>
  );
}
