import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_IMPORT_BYTES, type ImportReport } from "../lib/exchange";
import { exportFileName, formatUpdated } from "../lib/format";
import { exportAllText, exportLayoutText, importFromText } from "../store/exchange";
import { useLayoutStore } from "../store/layoutStore";
import CommitInput from "./CommitInput";
import { downloadText } from "./download";

const NEW_LAYOUT_SIZE = 17;

const iconProps = {
  "aria-hidden": true,
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-control text-ink-soft transition duration-150 ease-soft hover:bg-wash hover:text-ink";

type Notice = { kind: "ok" | "error"; text: string };

function describeReport(report: ImportReport): string {
  const parts: string[] = [];
  if (report.addedDefinitions > 0) {
    parts.push(`Added ${report.addedDefinitions} custom ${report.addedDefinitions === 1 ? "object" : "objects"} to your palette.`);
  }
  if (report.keptDefinitions > 0) {
    parts.push(`Kept your own version of ${report.keptDefinitions} ${report.keptDefinitions === 1 ? "object" : "objects"} that already existed.`);
  }
  const dropped = report.droppedUnknown + report.droppedMisfit;
  if (dropped > 0) {
    parts.push(`Left out ${dropped} ${dropped === 1 ? "object" : "objects"} that could not be placed.`);
  }
  return parts.join(" ");
}

/** Side sheet listing saved layouts: switch, rename, duplicate, export, delete, import and back up. */
export default function LayoutsDrawer({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const layouts = useLayoutStore((s) => s.layouts);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const createLayout = useLayoutStore((s) => s.createLayout);
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const renameLayout = useLayoutStore((s) => s.renameLayout);
  const duplicateLayout = useLayoutStore((s) => s.duplicateLayout);
  const deleteLayout = useLayoutStore((s) => s.deleteLayout);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const sorted = Object.values(layouts).sort((a, b) => b.updatedAt - a.updatedAt);
  const now = Date.now();

  const close = () => dialogRef.current?.close();

  const exportOne = (id: string) => {
    const layout = layouts[id];
    const text = exportLayoutText(id);
    if (layout && text) downloadText(exportFileName(layout.name, layout.width, layout.height, "json"), text);
  };

  const exportAll = () => {
    const text = exportAllText();
    if (!text) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`pixel-farm-backup-${stamp}.json`, text);
    setNotice({ kind: "ok", text: `Saved a backup of ${sorted.length} ${sorted.length === 1 ? "layout" : "layouts"}.` });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be chosen again later
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice({ kind: "error", text: "That file is too large to be a layout export." });
      return;
    }
    const outcome = importFromText(await file.text());
    if (!outcome.ok) {
      setNotice({ kind: "error", text: outcome.error });
      return;
    }
    const what =
      outcome.names.length === 1 ? `“${outcome.names[0]}”` : `${outcome.names.length} layouts`;
    setNotice({ kind: "ok", text: `Imported ${what}. ${describeReport(outcome.report)}`.trim() });
  };

  const remove = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) deleteLayout(id);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="layouts-title"
      className="m-0 mr-auto h-full max-h-none w-[min(26rem,100vw)] max-w-none overflow-y-auto bg-paper p-0 text-ink shadow-float backdrop:bg-ink/40"
      onClose={onClose}
    >
      <div className="flex min-h-full flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="layouts-title" className="text-2xl font-semibold">
              Your layouts
            </h2>
            <p className="text-ink-soft">Saved in this browser only. Export a backup now and then.</p>
          </div>
          <button type="button" aria-label="Close layouts" className={iconButton} onClick={close}>
            <svg {...iconProps}>
              <path d="m3.5 3.5 9 9m0-9-9 9" />
            </svg>
          </button>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              createLayout(`Farm ${sorted.length + 1}`, NEW_LAYOUT_SIZE, NEW_LAYOUT_SIZE);
              close();
            }}
          >
            <svg {...iconProps}>
              <path d="M8 3v10M3 8h10" />
            </svg>
            New layout
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <button type="button" className="btn btn-secondary" disabled={sorted.length === 0} onClick={exportAll}>
            Export all
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import layouts from a JSON file"
            className="hidden"
            onChange={onFile}
          />
        </div>

        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`rounded-control px-3 py-2 font-semibold ${
              notice.kind === "error" ? "bg-negative-wash text-negative" : "bg-sage-wash text-sage-deep"
            }`}
          >
            {notice.text}
          </p>
        )}

        {sorted.length === 0 ? (
          <p className="rounded-card border border-dashed border-control-edge p-6 text-center text-ink-soft">
            No layouts yet. Create one, or import a file.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((layout) => {
              const current = layout.id === activeLayoutId;
              return (
                <li
                  key={layout.id}
                  aria-current={current ? "true" : undefined}
                  className={`flex items-center gap-1 rounded-card border p-2 transition duration-150 ease-soft ${
                    current ? "border-primary bg-wash" : "border-line hover:bg-wash"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === layout.id ? (
                      <div onBlur={() => setRenamingId(null)}>
                        <CommitInput
                          aria-label={`Rename ${layout.name}`}
                          className="field w-full"
                          value={layout.name}
                          autoFocus
                          onCommit={(name) => renameLayout(layout.id, name)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="block w-full rounded-control px-2 py-1 text-left"
                        onClick={() => {
                          setActiveLayout(layout.id);
                          close();
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold">{layout.name}</span>
                          {current && (
                            <span className="shrink-0 rounded-full bg-primary px-2 text-xs font-semibold text-on-primary">
                              Open
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-ink-soft tabular-nums">
                          {layout.width} × {layout.height} · {layout.objects.length}{" "}
                          {layout.objects.length === 1 ? "object" : "objects"} · {formatUpdated(layout.updatedAt, now)}
                        </span>
                      </button>
                    )}
                  </div>
                  <button type="button" aria-label={`Rename ${layout.name}`} title="Rename" className={iconButton} onClick={() => setRenamingId(layout.id)}>
                    <svg {...iconProps}>
                      <path d="M2.5 13.5v-2.6l7.8-7.8 2.6 2.6-7.8 7.8h-2.6ZM9 4.4l2.6 2.6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate ${layout.name}`}
                    title="Duplicate"
                    className={iconButton}
                    onClick={() => {
                      duplicateLayout(layout.id);
                      close();
                    }}
                  >
                    <svg {...iconProps}>
                      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
                      <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
                    </svg>
                  </button>
                  <button type="button" aria-label={`Export ${layout.name} as JSON`} title="Export JSON" className={iconButton} onClick={() => exportOne(layout.id)}>
                    <svg {...iconProps}>
                      <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13h10" />
                    </svg>
                  </button>
                  <button type="button" aria-label={`Delete ${layout.name}`} title="Delete" className={iconButton} onClick={() => remove(layout.id, layout.name)}>
                    <svg {...iconProps}>
                      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
