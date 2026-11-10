import { useState } from "react";
import { exportPlayersPdf } from "../lib/exportPdf";
import { playerDisplayName } from "../lib/playerName";
import {
  bestMatchStandings,
  computePlayerStandings,
  playerRoundCell,
  scheduledTeamRounds,
  seasonRoundCount,
  splitPlayerStandingsByQualify,
  type PlayerStandingRow,
} from "../lib/standings";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";

function PlayersTable({
  players,
  roundCount,
  scheduled,
  emptyLabel,
}: {
  players: PlayerStandingRow[];
  roundCount: number;
  scheduled: Set<string>;
  emptyLabel: string;
}) {
  const colSpan = 5 + roundCount;
  return (
    <div className="board-view-table-wrap players-scroll">
      <table className="board-standings players">
        <thead>
          <tr>
            <th>#</th>
            <th>Igralec</th>
            <th>Ekipa</th>
            {Array.from({ length: roundCount }, (_, i) => (
              <th key={i} className="kolo">
                {i + 1}
              </th>
            ))}
            <th>Keglji</th>
            <th>Igre</th>
            <th>Povp.</th>
          </tr>
        </thead>
        <tbody>
          {players.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="board-empty">
                {emptyLabel}
              </td>
            </tr>
          )}
          {players.map((row, i) => (
            <tr key={row.player.id} className={i === 0 ? "is-lead" : undefined}>
              <td className="mono board-rank">{i + 1}</td>
              <td className="board-name">{playerDisplayName(row.player)}</td>
              <td className="board-team">{row.teamName}</td>
              {row.byRound.map((games, ri) => {
                const ignored = row.droppedRounds?.includes(ri) === true;
                return (
                  <td key={ri} className={ignored ? "mono kolo is-ignored" : "mono kolo"}>
                    {playerRoundCell(games, scheduled.has(`${ri + 1}:${row.player.teamId}`))}
                  </td>
                );
              })}
              <td className="mono">{row.pins}</td>
              <td className="mono">{row.games}</td>
              <td className="mono board-points">{row.avg.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type QualifyTab = "qualified" | "rest";

export function PlayerStandings() {
  const { state } = useStore();
  const roundCount = seasonRoundCount(state);
  const scheduled = scheduledTeamRounds(state.matches);
  const standings = computePlayerStandings(state);
  const { qualified, rest, split } = splitPlayerStandingsByQualify(state, standings);
  const best = bestMatchStandings(qualified);
  const [tab, setTab] = useState<QualifyTab>("qualified");
  const [bestOnly, setBestOnly] = useState(false);
  const showBest = split && tab === "qualified" && bestOnly;
  const active = showBest ? best : !split || tab === "qualified" ? qualified : rest;

  return (
    <>
      <header className="board-view-top">
        <div className="board-view-heading">
          <h2 className="board-view-title">Lestvica igralcev</h2>
          <PdfButton label="PDF igralcev" onExport={() => exportPlayersPdf(state)} />
        </div>
        <p className="board-view-sub">Razvrstitev po povprečju kegljev</p>
        {split && (
          <div className="board-view-toggle" role="group" aria-label="Lestvica igralcev">
            <button
              type="button"
              className={tab === "qualified" ? "is-on" : undefined}
              aria-pressed={tab === "qualified"}
              onClick={() => setTab("qualified")}
            >
              ≥ 70 % tekem
            </button>
            <button
              type="button"
              className={tab === "rest" ? "is-on" : undefined}
              aria-pressed={tab === "rest"}
              onClick={() => setTab("rest")}
            >
              &lt; 70 % tekem
            </button>
          </div>
        )}
        {split && tab === "qualified" && (
          <div className="board-view-toggle is-sub" role="group" aria-label="Znotraj 70 %">
            <button
              type="button"
              className={!bestOnly ? "is-on" : undefined}
              aria-pressed={!bestOnly}
              onClick={() => setBestOnly(false)}
            >
              Vse tekme
            </button>
            <button
              type="button"
              className={bestOnly ? "is-on" : undefined}
              aria-pressed={bestOnly}
              onClick={() => setBestOnly(true)}
            >
              60 % najboljših
            </button>
          </div>
        )}
        <p className="board-view-note">
          {showBest
            ? "Isti igralci kot pri ≥ 70 %. Štejejo se samo najboljše tekme (60 %, zaokroženo). Prečrtane se ne štejejo."
            : split && tab === "rest"
              ? "Igralci z manj kot 70 % odigranih tekem svoje ekipe."
              : split
                ? "Uradna lestvica: igralci z ≥ 70 % odigranih tekem svoje ekipe."
                : "Keglji na tekmo, skupaj, odigrane igre in povprečje. Po polovici sezone lahko preklopiš med uradno lestvico (≥ 70 % tekem) in preostalimi. Znotraj ≥ 70 % je še pogled najboljših 60 % tekem."}
        </p>
        <p className="board-view-note board-view-scroll-hint">Podrsaj vodoravno za kola.</p>
      </header>

      <PlayersTable
        players={active}
        roundCount={roundCount}
        scheduled={scheduled}
        emptyLabel={
          showBest
            ? "Nihče še nima 70 % tekem."
            : !split
              ? "Še ni odigranih iger."
              : tab === "qualified"
                ? "Nihče še nima 70 % tekem."
                : "Ni igralcev pod 70 % tekem."
        }
      />
    </>
  );
}
