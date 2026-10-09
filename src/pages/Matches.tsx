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
        <>
          <ResultHighlights scope="round" />
          <p className="muted" style={{ marginBottom: 20 }}>
            Klikni tekmo za sestavo in keglje.
          </p>
        </>
      )}
      {rounds.length === 0 && mode === "results" && (
        <p className="muted">Še ni vnesenih rezultatov.</p>
      )}
      {rounds.map((round) => {
        const meta = officialRoundMeta(round, seasonKey);
        const bye = meta?.bye ?? byeTeamName(round, state.teams, state.matches);
        const fixtures = [...(byRound.get(round) ?? [])].sort((a, b) =>
          (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
        );
        return (
          <div key={round}>
            <div className="panel">
              <h3 className="round-title">
                {round}. KOLO
                {meta ? ` — ${meta.label}` : ""}
              </h3>
              {bye && <p className="muted">Počiva: {bye}</p>}
              <div className="list" style={{ marginTop: 8 }}>
                {fixtures.map((match) => {
                  const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "?";
                  const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "?";
                  const totals = matchTotals(match, state.players);
                  const body = (
                    <>
                      {mode === "schedule" && (
                        <span className="match-when mono">{formatMatchWhen(match.startsAt)}</span>
                      )}
                      <span className="match-names">
                        {home} – {away}
                      </span>
                      <span className="mono">
                        {totals.complete
                          ? `${totals.homeMatch}:${totals.awayMatch} · ${totals.homeBig}:${totals.awayBig} · ${totals.homeSmall}:${totals.awaySmall}`
                          : ""}
                      </span>
                    </>
                  );
                  return onOpen ? (
                    <button className="row match-row" key={match.id} onClick={() => onOpen(match.id)}>
                      {body}
                    </button>
                  ) : (
                    <div className="row match-row" key={match.id}>
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
            {mode === "schedule" && meta?.noteAfter && (
              <p className="season-note">{meta.noteAfter}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
