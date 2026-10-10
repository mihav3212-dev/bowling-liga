import { inferSeasonKey, officialRoundMeta, seasonCatalog } from "../lib/fixtures";
import { formatMatchWhen } from "../lib/labels";
import { byeTeamName } from "../lib/schedule";
import { matchTotals } from "../lib/scoring";
import { useStore } from "../lib/store";
import { ResultHighlights } from "./ResultHighlights";

export function Matches({
  onOpen,
  mode,
}: {
  onOpen?: (id: string) => void;
  mode: "schedule" | "results";
}) {
  const { state } = useStore();
  const seasonKey = inferSeasonKey(state);
  const catalog = seasonCatalog(seasonKey);
  const byRound = new Map<number, typeof state.matches>();
  for (const match of state.matches) {
    if (mode === "results" && !matchTotals(match, state.players).complete) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => (mode === "results" ? b - a : a - b));

  return (
    <section>
      {mode === "schedule" && (
        <p className="muted" style={{ marginBottom: 20 }}>
          {catalog.intro}
        </p>
      )}
      {mode === "results" && rounds.length > 0 && (
        <p className="muted" style={{ marginBottom: 20 }}>
          Odpri kolo za tekme in najboljše rezultate tistega tedna.
        </p>
      )}
      {rounds.length === 0 && mode === "results" && (
        <p className="muted">Še ni vnesenih rezultatov.</p>
      )}
      {rounds.map((round, index) => {
        const meta = officialRoundMeta(round, seasonKey);
        const bye = meta?.bye ?? byeTeamName(round, state.teams, state.matches);
        const fixtures = [...(byRound.get(round) ?? [])].sort((a, b) =>
          (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
        );
        const heading = `${round}. KOLO${meta?.label || state.roundLabels?.[String(round)] ? ` — ${meta?.label || state.roundLabels?.[String(round)]}` : ""}`;
        const note = state.roundNotes?.[String(round)] || meta?.noteAfter;
        const body = (
          <>
            {bye && <p className="muted">Počiva: {bye}</p>}
            <div className="list" style={{ marginTop: 8 }}>
              {mode === "results" && (
                <div className="row match-row match-score-head">
                  <span className="match-names" />
                  <span className="match-scores">
                    <span>TOČKE</span>
                    <span>
                      Velike
                      <br />
                      točke
                    </span>
                    <span>Keglji</span>
                  </span>
                </div>
              )}
              {fixtures.map((match) => {
                const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
                const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
                const totals = matchTotals(match, state.players);
                const row = (
                  <>
                    {mode === "schedule" && (
                      <span className="match-when mono">{formatMatchWhen(match.startsAt)}</span>
                    )}
                    <span className="match-names">
                      {home} – {away}
                    </span>
                    {mode === "results" && totals.complete && (
                      <span className="match-scores mono">
                        <span>
                          {totals.homeMatch}:{totals.awayMatch}
                        </span>
                        <span>
                          {totals.homeBig}:{totals.awayBig}
                        </span>
                        <span>
                          {totals.homePins}:{totals.awayPins}
                        </span>
                      </span>
                    )}
                  </>
                );
                return onOpen ? (
                  <button className="row match-row" key={match.id} onClick={() => onOpen(match.id)}>
                    {row}
                  </button>
                ) : (
                  <div className="row match-row" key={match.id}>
                    {row}
                  </div>
                );
              })}
            </div>
            {mode === "results" && <ResultHighlights scope="round" round={round} state={state} />}
          </>
        );

        if (mode === "schedule") {
          return (
            <div key={round}>
              <div className="panel">
                <h3 className="round-title">{heading}</h3>
                {body}
              </div>
              {note && <p className="season-note">{note}</p>}
            </div>
          );
        }

        return (
          <details key={round} className="round-fold" open={index === 0}>
            <summary className="round-title">{heading}</summary>
            {body}
          </details>
        );
      })}
    </section>
  );
}
