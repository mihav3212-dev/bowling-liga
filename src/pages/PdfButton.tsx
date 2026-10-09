import { useState } from "react";

export function PdfButton({
  label,
  onExport,
}: {
  label: string;
  onExport: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="page-export">
      <button
        className="ghost"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onExport();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Pripravljam PDF…" : label}
      </button>
    </div>
  );
}
