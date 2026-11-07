import { useState } from "react";
import { exportPlayersPdf } from "../lib/exportPdf";
import { playerDisplayName } from "../lib/playerName";
import {
  computePlayerStandings,
  seasonRoundCount,
  splitPlayerStandingsByQualify,
  type PlayerStandingRow,
} from "../lib/standings";
import { useStore } from "../lib/store";
import { PdfButton } from "./PdfButton";

function PlayersTable({
  players,
  roundCount,
  emptyLabel,
}: {
  players: PlayerStandingRow[];
  roundCount: number;
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
                const pins = games.reduce((sum, n) => sum + n, 0);
                return (
                  <td key={ri} className="mono kolo">
                    {games.length ? pins : "—"}
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
  const { qualified, rest, split } = splitPlayerStandingsByQualify(
    state,
    computePlayerStandings(state),
  );
  const [tab, setTab] = useState<QualifyTab>("qualified");
  const active = !split || tab === "qualified" ? qualified : rest;

  return (
    <>
      <header className="board-view-top">
        <div className="board-view-heading">
          <h2 className="board-view-title">Lestvica igralcev</h2>
          <PdfButton label="PDF igralcev" onExport={() => exportPlayersPdf(state)} />
        </div>
        <p className="board-view-sub">Razvrstitev po povprečju kegljev</p>
        {split ? (
          <>
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
            <p className="board-view-note">
              {tab === "qualified"
                ? "Uradna lestvica: igralci z ≥ 70 % odigranih tekem svoje ekipe."
                : "Igralci z manj kot 70 % odigranih tekem svoje ekipe."}
            </p>
          </>
        ) : (
          <p className="board-view-note">
            Keglji na tekmo, skupaj, odigrane igre in povprečje. Po 3. kolu lahko preklopiš med
            uradno lestvico (≥ 70&nbsp;% tekem) in preostalimi.
          </p>
        )}
        <p className="board-view-note board-view-scroll-hint">Podrsaj vodoravno za kola.</p>
      </header>

      <PlayersTable
        players={active}
        roundCount={roundCount}
        emptyLabel={
          !split
            ? "Še ni odigranih iger."
            : tab === "qualified"
              ? "Nihče še nima 70 % tekem."
              : "Ni igralcev pod 70 % tekem."
        }
      />
    </>
  );
}
