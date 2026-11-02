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
  const { listSnapshots, restoreSnapshot, remote } = useStore();
  const [items, setItems] = useState<SeasonSnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = remote ? await listSnapshots() : [];
      if (!cancelled) {
        setItems(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listSnapshots, remote]);

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
          Avtomatsko po koncu vsakega kola (ko so vse tekme kola vnesene). Hranimo zadnjih 10 —
          starejše se zbrišejo. Obnovitev prepiše trenutno sezono.
        </p>

        {loading ? (
          <p className="muted">Nalagam…</p>
        ) : !remote ? (
          <p className="muted">Obnovitvene točke delujejo samo z bazo (Vercel / MySQL).</p>
        ) : items.length === 0 ? (
          <p className="muted">Še ni nobene točke. Pojavi se, ko bo prvo kolo v celoti odigrano.</p>
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
                  disabled={busyId != null}
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

        {note ? <p className="dialog-error">{note}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Zapri
          </button>
        </div>
      </div>
    </div>
  );
}
