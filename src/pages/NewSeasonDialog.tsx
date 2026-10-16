import { useEffect, useMemo, useState } from "react";
import { fetchLeague } from "../lib/leagueApi";
import { useStore } from "../lib/store";
import type { LeagueState, Player, Team } from "../lib/types";

type SourceRoster = { teams: Team[]; players: Player[] };

export function NewSeasonDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { state, seasons, seasonId, newEmptySeason, newSeasonFromRoster } = useStore();
  const sources = useMemo(
    () => seasons.filter((s) => !s.training),
    [seasons],
  );
  const [title, setTitle] = useState("");
  const [sourceId, setSourceId] = useState(seasonId ?? "");
  const [roster, setRoster] = useState<SourceRoster>({ teams: [], players: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includePlayers, setIncludePlayers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSourceId(seasonId ?? sources[0]?.id ?? "");
    setIncludePlayers(true);
    setError("");
    setBusy(false);
  }, [open, seasonId, sources]);

  useEffect(() => {
    if (!open || !sourceId) {
      setRoster({ teams: [], players: [] });
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    async function load() {
      try {
        let data: LeagueState | null = null;
        if (sourceId === seasonId) {
          data = state;
        } else {
          const payload = await fetchLeague(sourceId);
          data = payload.current?.data ?? null;
        }
        if (cancelled) return;
        const teams = (data?.teams ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "sl"));
        const players = data?.players ?? [];
        setRoster({ teams, players });
        setSelected(new Set(teams.map((t) => t.id)));
      } catch {
        if (!cancelled) {
          setRoster({ teams: [], players: [] });
          setSelected(new Set());
          setError("Ekip iz izbrane sezone ni bilo mogoče naložiti.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, sourceId, seasonId, state]);

  if (!open) return null;

  const allSelected = roster.teams.length > 0 && selected.size === roster.teams.length;
  const playerCount = (teamId: string) => roster.players.filter((p) => p.teamId === teamId).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(roster.teams.map((t) => t.id)));
  };

  const submit = async () => {
    const name = title.trim() || "Nova sezona";
    setBusy(true);
    setError("");
    try {
      if (selected.size === 0) {
        await newEmptySeason(name);
      } else {
        await newSeasonFromRoster(name, {
          sourceSeasonId: sourceId,
          teams: roster.teams,
          players: roster.players,
          teamIds: [...selected],
          includePlayers,
        });
      }
      onCreated();
      onClose();
    } catch {
      setError("Sezone ni bilo mogoče ustvariti.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-labelledby="new-season-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-season-title">Nova sezona</h2>
        <p className="muted">
          Izberi ekipe iz prejšnje sezone — ni jih treba znova vnašati. Tekme in rezultati se ne
          prenesejo.
        </p>

        <label className="dialog-field">
          Ime sezone
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="npr. 2027/2028"
            autoFocus
          />
        </label>

        <label className="dialog-field">
          Prenesi ekipe iz
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            disabled={sources.length === 0}
          >
            {sources.length === 0 ? (
              <option value="">Ni sezon</option>
            ) : (
              sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.archived ? " (arhiv)" : ""}
                  {s.id === seasonId ? " — trenutna" : ""}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="dialog-roster">
          <div className="dialog-roster-head">
            <strong>Ekipe</strong>
            <button type="button" className="ghost" onClick={toggleAll} disabled={loading || !roster.teams.length}>
              {allSelected ? "Odstrani vse" : "Izberi vse"}
            </button>
          </div>
          {loading ? (
            <p className="muted">Nalagam…</p>
          ) : roster.teams.length === 0 ? (
            <p className="muted">V izbrani sezoni ni ekip.</p>
          ) : (
            <ul className="dialog-team-list">
              {roster.teams.map((team) => (
                <li key={team.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(team.id)}
                      onChange={() => toggle(team.id)}
                    />
                    <span>{team.name}</span>
                    <span className="muted">{playerCount(team.id)} igralcev</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="dialog-check">
          <input
            type="checkbox"
            checked={includePlayers}
            onChange={(e) => setIncludePlayers(e.target.checked)}
            disabled={selected.size === 0}
          />
          Prenesi tudi igralce izbranih ekip
        </label>

        {error && <p className="dialog-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Prekliči
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Ustvarjam…" : selected.size ? `Ustvari z ${selected.size} ekipami` : "Ustvari prazno"}
          </button>
        </div>
      </div>
    </div>
  );
}
