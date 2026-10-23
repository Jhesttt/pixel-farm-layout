import { useEffect, useRef, useState } from "react";
import { exportFileName } from "../lib/format";
import {
  canvasToPngBlob,
  exportSize,
  fitsExportLimit,
  renderLayoutToCanvas,
  type RenderOptions,
} from "../lib/renderToCanvas";
import { exportLayoutText } from "../store/exchange";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import { EXPORT_THEME } from "../theme/exportTheme";
import type { ViewSettings } from "../types";
import { downloadBlob, downloadText } from "./download";

const BASE_CELL = 32; // 1x: a 17x17 grid is 544px wide
const SCALES = [1, 2, 4] as const;
const PREVIEW_MAX_PX = 420;

const BACKGROUNDS = [
  { key: "cream", label: "Cream", color: EXPORT_THEME.page },
  { key: "paper", label: "Paper", color: EXPORT_THEME.paper },
  { key: "white", label: "White", color: "#ffffff" },
  { key: "transparent", label: "Transparent", color: null },
] as const;

type BackgroundKey = (typeof BACKGROUNDS)[number]["key"];

const OPTION_TOGGLES = [
  { key: "showGrid", label: "Grid lines" },
  { key: "showEffects", label: "Areas of effect" },
  { key: "showLabels", label: "Labels" },
  { key: "showCoordinates", label: "Coordinates" },
] as const;

type ToggleKey = (typeof OPTION_TOGGLES)[number]["key"];

const VIEWS: { key: ViewSettings["projection"]; label: string }[] = [
  { key: "top", label: "Top view" },
  { key: "iso", label: "Isometric" },
];

/** Cell size for the preview so it lands near PREVIEW_MAX_PX across, for either view. */
function previewCell(cols: number, rows: number, projection: ViewSettings["projection"]): number {
  // An isometric image is (cols + rows) * 0.75 cells wide at this export's 1.5 tile per cell.
  const across = projection === "iso" ? (cols + rows) * 0.75 : Math.max(cols, rows);
  return Math.max(6, Math.min(28, Math.floor(PREVIEW_MAX_PX / across)));
}

/** Modal for exporting the open layout as a PNG (top or isometric, 1x / 2x / 4x) or as JSON. */
export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const layout = useLayoutStore(selectActiveLayout);
  const view = useLayoutStore((s) => s.view);
  const definitions = useLibraryStore((s) => s.definitions);

  // Start from the view you are looking at.
  const [projection, setProjection] = useState<ViewSettings["projection"]>(view.projection);
  const [scale, setScale] = useState<(typeof SCALES)[number]>(1);
  const [background, setBackground] = useState<BackgroundKey>("cream");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    showGrid: view.showGrid,
    showEffects: view.showEffects,
    showLabels: view.showLabels,
    showCoordinates: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const optionsFor = (cellSize: number): RenderOptions => ({
    cellSize,
    ...toggles,
    background: BACKGROUNDS.find((b) => b.key === background)?.color ?? null,
    padding: Math.round(cellSize * 0.5),
    projection,
  });

  const scaleInfo = layout
    ? SCALES.map((s) => {
        const options = optionsFor(BASE_CELL * s);
        return { scale: s, size: exportSize(layout, options), fits: fitsExportLimit(layout, options) };
      })
    : [];
  const fitsKey = scaleInfo.map((i) => (i.fits ? "1" : "0")).join("");

  // If the chosen scale becomes too large (e.g. coordinates switched on), step down.
  useEffect(() => {
    const chosen = scaleInfo.find((i) => i.scale === scale);
    if (chosen && !chosen.fits) {
      const fallback = [...scaleInfo].reverse().find((i) => i.fits);
      if (fallback) setScale(fallback.scale);
    }
  }, [fitsKey, scale]); // scaleInfo is derived from fitsKey's inputs on every render

  // Live preview: the same renderer at a size that fits the dialog.
  useEffect(() => {
    const host = previewRef.current;
    if (!host || !layout) return;
    const cell = previewCell(layout.width, layout.height, projection);
    const canvas = renderLayoutToCanvas(layout, definitions, optionsFor(cell));
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Preview of ${layout.name}`);
    host.replaceChildren(canvas);
  }, [layout, definitions, toggles, background, projection]);

  if (!layout) return null;

  const close = () => dialogRef.current?.close();

  const exportPng = async () => {
    setBusy(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0)); // let "Rendering…" paint first
      await document.fonts?.ready;
      const canvas = renderLayoutToCanvas(layout, definitions, optionsFor(BASE_CELL * scale));
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(
        exportFileName(layout.name, layout.width, layout.height, "png", projection === "iso" ? "isometric" : undefined),
        blob,
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while creating the image.");
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    const text = exportLayoutText(layout.id);
    if (text) downloadText(exportFileName(layout.name, layout.width, layout.height, "json"), text);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto rounded-card bg-paper p-0 text-ink shadow-float backdrop:bg-ink/40"
      onClose={onClose}
    >
      <div className="flex flex-col gap-5 p-6">
        <header>
          <h2 id="export-title" className="text-2xl font-semibold">
            Export “{layout.name}”
          </h2>
          <p className="text-ink-soft">Save an image to share or print, or a JSON file to back it up.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,18rem)]">
          <div className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">View</legend>
              <div role="group" aria-label="Image view" className="inline-flex self-start overflow-hidden rounded-control border border-control-edge bg-paper">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={projection === v.key}
                    className={`h-9 px-4 text-sm font-semibold transition duration-150 ease-soft focus-visible:outline-offset-[-3px] ${
                      projection === v.key ? "bg-primary text-on-primary" : "text-ink hover:bg-wash"
                    }`}
                    onClick={() => setProjection(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Size</legend>
              {scaleInfo.map(({ scale: s, size, fits }) => (
                <label
                  key={s}
                  className={`flex items-center gap-3 rounded-control border px-3 py-2 ${
                    scale === s ? "border-primary bg-wash" : "border-line"
                  } ${fits ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                >
                  <input
                    type="radio"
                    name="export-scale"
                    className="h-4 w-4 accent-primary"
                    checked={scale === s}
                    disabled={!fits}
                    onChange={() => setScale(s)}
                  />
                  <span className="font-semibold">{s}x</span>
                  <span className="text-ink-soft tabular-nums">
                    {size.width} × {size.height} px{fits ? "" : " · too large for browsers"}
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Include</legend>
              {OPTION_TOGGLES.map((t) => (
                <label key={t.key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={toggles[t.key]}
                    onChange={(e) => setToggles((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                  />
                  {t.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Background</legend>
              <div className="flex flex-wrap gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    aria-pressed={background === b.key}
                    className={`btn btn-secondary h-8 px-3 text-xs ${
                      background === b.key ? "outline-[3px] outline-offset-2 outline-primary" : ""
                    }`}
                    onClick={() => setBackground(b.key)}
                  >
                    {b.color && (
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-ink-deep/40"
                        style={{ backgroundColor: b.color }}
                      />
                    )}
                    {b.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div
            ref={previewRef}
            className="flex items-start justify-center self-start rounded-card bg-sunken p-3"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-control bg-negative-wash px-3 py-2 font-semibold text-negative">
            {error}
          </p>
        )}

        <footer className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            Download JSON
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={exportPng}>
            {busy ? "Rendering…" : "Download PNG"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
