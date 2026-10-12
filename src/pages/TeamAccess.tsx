import { TEAM_PERM_HINTS, TEAM_PERM_KEYS, TEAM_PERM_LABELS, defaultTeamPerms, teamPerms } from "../lib/access";
import type { TeamPerm } from "../lib/access";
import { useStore } from "../lib/store";

export function TeamAccess() {
  const { state, setTeamPerms } = useStore();

  return (
    <section className="panel">
      <h2 className="round-title">Dovoljenja ekip</h2>
      <p className="muted">
        Za vsako ekipo z geslom izbereš, kaj sme v aplikaciji. Brez kljukice vidi samo javni razpored,
        rezultate in lestvico. Sestava tekem je privzeto vklopljena.
      </p>
      {state.teams.length === 0 ? (
        <p className="muted">Najprej dodaj ekipe.</p>
      ) : (
        <div className="table-scroll">
          <table className="standings perm-table">
            <thead>
              <tr>
                <th>Ekipa</th>
                {TEAM_PERM_KEYS.map((key) => (
                  <th key={key} title={TEAM_PERM_HINTS[key]}>
                    {TEAM_PERM_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.teams.map((team) => {
                const perms = teamPerms(team);
                return (
                  <tr key={team.id}>
                    <td>
                      {team.name}
                      <div className="muted">{team.hasAccess ? "Prijava vklopljena" : "Brez gesla"}</div>
                    </td>
                    {TEAM_PERM_KEYS.map((key) => (
                      <td key={key} className="num">
                        <label className="perm-check">
                          <input
                            type="checkbox"
                            checked={perms[key]}
                            aria-label={`${team.name}: ${TEAM_PERM_LABELS[key]}`}
                            onChange={(e) => {
                              const on = e.target.checked;
                              const patch: Partial<Record<TeamPerm, boolean>> = { [key]: on };
                              if (key === "resultsEdit" && on) patch.results = true;
                              if (key === "results" && !on) patch.resultsEdit = false;
                              setTeamPerms(team.id, defaultTeamPerms({ ...perms, ...patch }));
                            }}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
