import { useEffect, useState } from "react";
import { exportRegistrationPdf } from "../lib/exportPdf";
import type { Gender } from "../lib/types";
import { teamRosterWindowOpen } from "../lib/access";
import { computePlayerDetailStats } from "../lib/standings";
import { useStore } from "../lib/store";
import { formatInviteCode, formatInviteUntil, inviteStillOpen } from "../lib/invite";
import { PlayerDetail } from "./PlayerDetail";
import { Training } from "./Training";

export function TeamDetail({
  teamId,
  onBack,
  backLabel = "← Ekipe",
  canManage = true,
  canRoster = true,
  showTraining = true,
  onOpenMatch,
}: {
  teamId: string;
  onBack: () => void;
  backLabel?: string;
  canManage?: boolean;
  canRoster?: boolean;
  showTraining?: boolean;
  onOpenMatch?: (matchId: string) => void;
}) {
  const {
    state,
    remote,
    renameTeam,
    updateTeam,
    addPlayer,
    updatePlayer,
    removePlayer,
    setTeamAccess,
    createTeamInvite,
    saveTeamRosterNow,
  } = useStore();
  const team = state.teams.find((t) => t.id === teamId);
  const players = state.players.filter((p) => p.teamId === teamId);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [bzs, setBzs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [access, setAccess] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteUntil, setInviteUntil] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [trainingSessionId, setTrainingSessionId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    setTrainingSessionId(null);
    setDetailPlayerId(null);
    setSettingsOpen(false);
    setContactOpen(false);
    setInviteUrl("");
    setInviteCode("");
    setInviteUntil("");
    setInviteNote("");
    setSaveNote("");
  }, [teamId]);

  if (!team) return <p>Ekipa ne obstaja.</p>;
  const rosterOpen = teamRosterWindowOpen(state.matches);
  const editRoster = canRoster && (canManage || rosterOpen);
  const showSettings = canManage || editRoster;

  if (detailPlayerId) {
    return (
      <PlayerDetail
        playerId={detailPlayerId}
        onBack={() => setDetailPlayerId(null)}
        onOpenMatch={onOpenMatch}
      />
    );
  }

  return (
    <>
      <section className="panel">
        <button className="ghost" type="button" onClick={onBack}>
          {backLabel}
        </button>

        <div className="team-detail-head">
          <h2 className="team-detail-title">{team.name}</h2>
          {showSettings && (
            <button
              className="ghost team-settings-btn"
              type="button"
              aria-label="Nastavitve ekipe"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            >
              <span className="team-settings-icon" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
          )}
        </div>

        {canManage ? (
          <button
            type="button"
            className="team-contact-card is-editable"
            onClick={() => setContactOpen(true)}
          >
            <span className="team-contact-row">
              <span className="muted">Vodja ekipe</span>
              <strong>{team.captain?.trim() || "—"}</strong>
            </span>
            <span className="team-contact-row">
              <span className="muted">Tel. št.</span>
              <strong>{team.phone?.trim() || "—"}</strong>
            </span>
            <span className="team-contact-row">
              <span className="muted">E-pošta</span>
              <strong>{team.email?.trim() || "—"}</strong>
            </span>
          </button>
        ) : (
          <div className="team-contact-card">
            <div className="team-contact-row">
              <span className="muted">Vodja ekipe</span>
              <strong>{team.captain?.trim() || "—"}</strong>
            </div>
            <div className="team-contact-row">
              <span className="muted">Tel. št.</span>
              <strong>{team.phone?.trim() || "—"}</strong>
            </div>
            <div className="team-contact-row">
              <span className="muted">E-pošta</span>
              <strong>{team.email?.trim() || "—"}</strong>
            </div>
          </div>
        )}

        <h3 style={{ marginTop: 24 }}>Igralci ({players.length})</h3>
        <p className="muted">
          {editRoster
            ? "Člane dodajaš in urejaš v nastavitvah (☰)."
            : canRoster && !rosterOpen
              ? "Od 2. kola naprej člane spreminja samo admin."
              : "Igralce vnaša admin ali vodja z dovoljenjem za vnos v ekipo."}
        </p>
        <div className="list roster-list" style={{ marginTop: 16 }}>
          {players.length === 0 && <p className="muted">Še ni igralcev.</p>}
          {players.map((p) => {
            const stats = computePlayerDetailStats(state, p.id);
            const summary =
              stats && stats.games > 0
                ? `${stats.games} iger · povp. ${stats.avg.toFixed(1)} · skupaj ${stats.pins}`
                : "Še ni iger";
            return (
              <div key={p.id} className="roster-player-row-view">
                <div className="roster-player-main">
                  <strong className="roster-player-name">{p.name}</strong>
                  <span className="muted roster-player-gender">
                    {p.gender === "F" ? "ženska" : "moški"}
                    {p.bzsMember ? " · BZS" : ""}
                  </span>
                </div>
                <div className="roster-player-side">
                  <span className="muted roster-player-stats">{summary}</span>
                  <button
                    className="ghost roster-player-detail-btn"
                    type="button"
                    onClick={() => setDetailPlayerId(p.id)}
                  >
                    Ogled podrobnosti
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {contactOpen && canManage && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="dialog-panel"
            role="dialog"
            aria-labelledby="team-contact-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="team-contact-title">Vodja ekipe</h2>
            <p className="muted">Vpiši kontaktne podatke vodje.</p>
            <label className="dialog-field">
              Ime in priimek
              <input
                value={team.captain ?? ""}
                onChange={(e) => updateTeam(team.id, { captain: e.target.value })}
                placeholder="Vodja ekipe"
                autoFocus
              />
            </label>
            <label className="dialog-field">
              Tel. št.
              <input
                value={team.phone ?? ""}
                onChange={(e) => updateTeam(team.id, { phone: e.target.value })}
                placeholder="Tel. številka"
              />
            </label>
            <label className="dialog-field">
              E-pošta
              <input
                value={team.email ?? ""}
                onChange={(e) => updateTeam(team.id, { email: e.target.value })}
                placeholder="E-pošta"
                type="email"
              />
            </label>
            <div className="dialog-actions">
              <button className="primary" type="button" onClick={() => setContactOpen(false)}>
                Shrani
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="dialog-panel team-settings-panel"
            role="dialog"
            aria-labelledby="team-settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-settings-panel-head">
              <h2 id="team-settings-title">Nastavitve ekipe</h2>
              <button className="ghost" type="button" onClick={() => setSettingsOpen(false)}>
                Zapri
              </button>
            </div>

            {canManage && (
              <>
                <label className="dialog-field">
                  Ime ekipe
                  <input
                    value={team.name}
                    onChange={(e) => renameTeam(team.id, e.target.value)}
                    aria-label="Ime ekipe"
                  />
                </label>

                <h3 className="team-settings-section" style={{ marginTop: 8 }}>
                  Vodja ekipe
                </h3>
                <label className="dialog-field">
                  Ime in priimek
                  <input
                    value={team.captain ?? ""}
                    onChange={(e) => updateTeam(team.id, { captain: e.target.value })}
                    placeholder="Vodja ekipe"
                  />
                </label>
                <label className="dialog-field">
                  Tel. št.
                  <input
                    value={team.phone ?? ""}
                    onChange={(e) => updateTeam(team.id, { phone: e.target.value })}
                    placeholder="Tel. številka"
                  />
                </label>
                <label className="dialog-field">
                  E-pošta
                  <input
                    value={team.email ?? ""}
                    onChange={(e) => updateTeam(team.id, { email: e.target.value })}
                    placeholder="E-pošta"
                    type="email"
                  />
                </label>

                <button
                  className="ghost"
                  type="button"
                  style={{ width: "100%" }}
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await exportRegistrationPdf(state, team.id);
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? "Pripravljam…" : "Izvozi prijavni list"}
                </button>

                <h3 className="team-settings-section">Prijava ekipe</h3>
                <p className="muted">
                  Ustvari kodo in jo pošlji kapitanu (npr. v Messengerju). Kapetan jo vpiše zgoraj pri
                  prijavi (Geslo ali koda) — odpre se nastavitev gesla. Kaj smejo v aplikaciji,
                  nastaviš v Admin → Dovoljenja ekip.{" "}
                  {team.hasAccess ? "Prijava je vklopljena." : "Prijava še ni nastavljena."}
                </p>
                <div className="row-actions" style={{ marginBottom: 12 }}>
                  <button
                    className="primary"
                    type="button"
                    disabled={accessBusy}
                    onClick={async () => {
                      setAccessBusy(true);
                      setInviteNote("");
                      try {
                        const created = await createTeamInvite(team.id);
                        const code = formatInviteCode(created.token);
                        setInviteCode(code);
                        setInviteUrl(created.url);
                        setInviteUntil(created.expiresAt);
                        try {
                          await navigator.clipboard.writeText(code);
                          setInviteNote("Koda je v odložišču — prilepi jo v sporočilo kapitanu.");
                        } catch {
                          setInviteNote("Kopiraj kodo in jo pošlji kapitanu.");
                        }
                      } catch {
                        window.alert("Kode ni bilo mogoče ustvariti.");
                      } finally {
                        setAccessBusy(false);
                      }
                    }}
                  >
                    {accessBusy
                      ? "…"
                      : inviteStillOpen(team) || inviteCode
                        ? "Nova koda"
                        : "Ustvari kodo za geslo"}
                  </button>
                  {inviteCode && (
                    <button
                      className="ghost"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteCode);
                          setInviteNote("Koda je v odložišču.");
                        } catch {
                          setInviteNote("Označi kodo in jo skopiraj.");
                        }
                      }}
                    >
                      Kopiraj kodo
                    </button>
                  )}
                </div>
                {inviteCode && (
                  <p className="invite-code-block" aria-label="Koda ekipe">
                    <span className="muted">Koda</span>
                    <strong className="invite-code">{inviteCode}</strong>
                  </p>
                )}
                {(inviteCode || inviteStillOpen(team)) && (
                  <p className="muted">
                    {inviteCode ? (
                      <>
                        Koda velja do {formatInviteUntil(inviteUntil || team.inviteExpires)}. Nova
                        koda prejšnjo razveljavi.
                      </>
                    ) : (
                      <>
                        Aktivna koda do {formatInviteUntil(team.inviteExpires)}. Nova jo razveljavi.
                      </>
                    )}
                    {!remote ? " Brez baze deluje samo v tem brskalniku." : ""}
                  </p>
                )}
                {inviteUrl && (
                  <details className="invite-link-details">
                    <summary className="muted">Povezava (lahko v Messengerju ne deluje)</summary>
                    <p className="form-row" style={{ marginTop: 8 }}>
                      <input
                        readOnly
                        value={inviteUrl}
                        aria-label="Povezava za geslo"
                        onFocus={(e) => e.target.select()}
                      />
                    </p>
                  </details>
                )}
                {inviteNote && <p className="muted">{inviteNote}</p>}
                <p className="muted">Ali vpiši geslo sam in ga povej kapitanu:</p>
                <form
                  className="form-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAccessBusy(true);
                    try {
                      await setTeamAccess(team.id, access);
                      setAccess("");
                    } catch {
                      window.alert("Gesla ni bilo mogoče shraniti.");
                    } finally {
                      setAccessBusy(false);
                    }
                  }}
                >
                  <input
                    type="password"
                    value={access}
                    onChange={(e) => setAccess(e.target.value)}
                    placeholder={team.hasAccess ? "Novo geslo ekipe" : "Geslo ekipe"}
                    autoComplete="new-password"
                  />
                  <button
                    className="primary"
                    type="submit"
                    disabled={accessBusy || !access.trim()}
                  >
                    {accessBusy ? "…" : "Nastavi geslo"}
                  </button>
                  {team.hasAccess && (
                    <button
                      className="danger"
                      type="button"
                      disabled={accessBusy}
                      onClick={async () => {
                        if (!window.confirm("Odstranim prijavo te ekipe?")) return;
                        setAccessBusy(true);
                        try {
                          await setTeamAccess(team.id, "");
                        } finally {
                          setAccessBusy(false);
                        }
                      }}
                    >
                      Odstrani prijavo
                    </button>
                  )}
                </form>
              </>
            )}

            {(editRoster || canManage) && (
              <>
                <h3 className="team-settings-section">Vnos igralcev</h3>
                <p className="muted">
                  {editRoster
                    ? canManage
                      ? "Seznam je neomejen. Pred tekmo izbereš 4 + do 2 menjavi. Po vnosu pritisni Shrani."
                      : "Člane lahko vnašate do začetka 2. kola. Po vnosu pritisni Shrani."
                    : "Od 2. kola naprej člane spreminja samo admin."}
                </p>
                {editRoster && (
                  <form
                    className="form-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!name.trim()) return;
                      addPlayer(team.id, name, gender, bzs);
                      setName("");
                      setGender("M");
                      setBzs(false);
                    }}
                  >
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.toLocaleUpperCase("sl"))}
                      placeholder="Priimek in ime igralca"
                      aria-label="Priimek in ime igralca"
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                    >
                      <option value="M">Moški</option>
                      <option value="F">Ženska (+8)</option>
                    </select>
                    <label className="muted">
                      <input
                        type="checkbox"
                        checked={bzs}
                        onChange={(e) => setBzs(e.target.checked)}
                      />{" "}
                      član BZS (−8)
                    </label>
                    <button className="primary" type="submit">
                      Dodaj
                    </button>
                  </form>
                )}
                <div className="list roster-list" style={{ marginTop: 16 }}>
                  {players.map((p) => (
                    <div key={p.id} className="form-row roster-player-row">
                      {editRoster ? (
                        <>
                          <input
                            className="roster-player-name-input"
                            value={p.name}
                            aria-label="Priimek in ime igralca"
                            onChange={(e) =>
                              updatePlayer({
                                ...p,
                                name: e.target.value.toLocaleUpperCase("sl"),
                              })
                            }
                            onBlur={(e) => {
                              const trimmed = e.target.value.trim().toLocaleUpperCase("sl");
                              if (trimmed !== p.name) {
                                updatePlayer({ ...p, name: trimmed || p.name });
                              }
                            }}
                          />
                          <label className="muted">
                            <input
                              type="checkbox"
                              checked={p.gender === "F"}
                              onChange={(e) =>
                                updatePlayer({
                                  ...p,
                                  gender: e.target.checked ? "F" : "M",
                                })
                              }
                            />{" "}
                            ženska
                          </label>
                          <label className="muted">
                            <input
                              type="checkbox"
                              checked={p.bzsMember}
                              onChange={(e) =>
                                updatePlayer({ ...p, bzsMember: e.target.checked })
                              }
                            />{" "}
                            BZS
                          </label>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => removePlayer(p.id)}
                          >
                            Odstrani
                          </button>
                        </>
                      ) : (
                        <strong className="roster-player-name">{p.name}</strong>
                      )}
                    </div>
                  ))}
                </div>
                <div className="row-actions" style={{ marginTop: 16 }}>
                  <button
                    className="primary"
                    type="button"
                    disabled={saveBusy}
                    onClick={async () => {
                      setSaveBusy(true);
                      setSaveNote("");
                      const ok = await saveTeamRosterNow(team.id);
                      setSaveBusy(false);
                      setSaveNote(
                        ok
                          ? remote
                            ? "Shranjeno v bazo."
                            : "Shranjeno v ta brskalnik."
                          : "Shranjevanje ni uspelo. Poskusi znova.",
                      );
                    }}
                  >
                    {saveBusy ? "Shranjujem…" : "Shrani"}
                  </button>
                  {saveNote && <span className="muted">{saveNote}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showTraining && (
        <Training
          sessionId={trainingSessionId}
          ownerTeamId={teamId}
          canPickTeam={false}
          onOpen={setTrainingSessionId}
          onBack={() => setTrainingSessionId(null)}
        />
      )}
    </>
  );
}
