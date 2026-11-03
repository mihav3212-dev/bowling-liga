import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import type { SeasonSnapshotInfo } from "../lib/leagueApi";

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SeasonSnapshotsDialog({ onClose }: { onClose: () => void }) {
  const { listSnapshots, createSnapshot, restoreSnapshot, remote, seasonId } = useStore();
  const [items, setItems] = useState<SeasonSnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNote("");
      if (!remote) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      const next = await listSnapshots();
      if (!cancelled) {
        setItems(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remote, seasonId]);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel swap-times-panel"
        role="dialog"
        aria-labelledby="snapshots-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="snapshots-title">Obnovitvene točke</h2>
        <p className="muted">
          Avtomatsko po koncu vsakega kola (ko so vse tekme kola vnesene). Hranimo zadnjih 10.
          Obnovitev prepiše trenutno sezono.
        </p>

        {loading ? (
          <p className="muted">Nalagam…</p>
        ) : !remote ? (
          <p className="muted">
            Obnovitvene točke delujejo samo, ko je sezona povezana z bazo (MySQL). Zdaj teče lokalni
            način — točke se ne shranjujejo.
          </p>
        ) : (
          <>
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="primary"
                disabled={creating || busyId != null}
                onClick={async () => {
                  setCreating(true);
                  setNote("");
                  const next = await createSnapshot("Ročna točka");
                  setCreating(false);
                  if (!next.length && items.length === 0) {
                    setNote("Točke ni bilo mogoče ustvariti. Preveri povezavo z bazo.");
                    return;
                  }
                  setItems(next);
                  setNote(next.length ? "Točka shranjena." : "Shranjevanje ni uspelo.");
                }}
              >
                {creating ? "Shranjujem…" : "Ustvari točko zdaj"}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Še ni nobene točke. Pojavi se avtomatsko po koncu kola — ali jo ustvari ročno zgoraj.
              </p>
            ) : (
              <ul className="snapshot-list">
                {items.map((item) => (
                  <li key={item.id} className="snapshot-row">
                    <div>
                      <strong>{item.label}</strong>
                      <div className="muted">{formatWhen(item.createdAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busyId != null || creating}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Obnovim sezono na „${item.label}“ (${formatWhen(item.createdAt)})?\nTrenutni rezultati po tej točki se izgubijo.`,
                          )
                        ) {
                          return;
                        }
                        setBusyId(item.id);
                        setNote("");
                        const ok = await restoreSnapshot(item.id);
                        setBusyId(null);
                        if (!ok) {
                          setNote("Obnovitev ni uspela.");
                          return;
                        }
                        onClose();
                      }}
                    >
                      {busyId === item.id ? "Obnavljam…" : "Obnovi"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {note ? (
          <p className={note.includes("uspelo") || note.includes("mogoče") ? "dialog-error" : "muted"}>
            {note}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Zapri
          </button>
        </div>
      </div>
    </div>
  );
}
