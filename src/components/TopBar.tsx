import { useState } from "react";
import { GRID_MAX_SIZE, GRID_MIN_SIZE, clampGridSize, getObjectsOutsideSize } from "../lib/grid";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import BrandMark from "./BrandMark";
import CommitInput from "./CommitInput";
import ExportDialog from "./ExportDialog";
import LayoutsDrawer from "./LayoutsDrawer";

const SIZE_PRESETS = [15, 17, 20, 24, 32];

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

export default function TopBar() {
  const layout = useLayoutStore(selectActiveLayout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const renameLayout = useLayoutStore((s) => s.renameLayout);
  const resizeLayout = useLayoutStore((s) => s.resizeLayout);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const canUndo = useLayoutStore((s) => s.history.past.length > 0);
  const canRedo = useLayoutStore((s) => s.history.future.length > 0);
  const definitions = useLibraryStore((s) => s.definitions);

  const requestResize = (width: number, height: number) => {
    if (!layout) return;
    const w = clampGridSize(width);
    const h = clampGridSize(height);
    const dropped = getObjectsOutsideSize(layout, definitions, w, h).length;
    if (dropped > 0) {
      const noun = dropped === 1 ? "object" : "objects";
      if (!window.confirm(`Resizing to ${w}x${h} will remove ${dropped} ${noun}. Continue?`)) return;
    }
    resizeLayout(layout.id, w, h, definitions);
  };

  const commitSide = (side: "width" | "height", text: string) => {
    if (!layout) return;
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return;
    requestResize(side === "width" ? n : layout.width, side === "height" ? n : layout.height);
  };

  const presetValue =
    layout && layout.width === layout.height && SIZE_PRESETS.includes(layout.width)
      ? String(layout.width)
      : "custom";

  // Icon buttons on phones (the label is hidden but still the accessible name); text from md up.
  const iconOnly = "max-md:h-10 max-md:w-10 max-md:px-0";
  const label = "max-md:sr-only";

  return (
    <header className="flex flex-wrap items-end gap-x-2 gap-y-1.5 border-b border-line bg-paper px-3 py-1.5 md:min-h-20 md:gap-x-6 md:gap-y-3 md:px-5 md:py-3">
      <div className="mr-auto flex items-center gap-2 self-center text-primary-strong md:mr-0 md:gap-3">
        <BrandMark />
        <h1 className="text-xl leading-none font-semibold text-ink md:text-2xl">Pixel Farm</h1>
      </div>

      <button type="button" aria-label="Layouts" className={`btn btn-secondary ${iconOnly}`} onClick={() => setDrawerOpen(true)}>
        <svg {...iconProps}>
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
        </svg>
        <span className={label}>Layouts</span>
      </button>

      {layout && (
        <>
          <div role="group" aria-label="History" className="flex gap-2">
            <button type="button" aria-label="Undo" className={`btn btn-secondary ${iconOnly}`} disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={undo}>
              <svg {...iconProps}>
                <path d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H6M3.5 6.5l3-3M3.5 6.5l3 3" />
              </svg>
              <span className={label}>Undo</span>
            </button>
            <button type="button" aria-label="Redo" className={`btn btn-secondary ${iconOnly}`} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={redo}>
              <span className={label}>Redo</span>
              <svg {...iconProps}>
                <path d="M12.5 6.5h-6a3.5 3.5 0 0 0 0 7H10M12.5 6.5l-3-3M12.5 6.5l-3 3" />
              </svg>
            </button>
          </div>

          <button type="button" aria-label="Export" className={`btn btn-secondary ${iconOnly}`} onClick={() => setExportOpen(true)}>
            <svg {...iconProps}>
              <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13h10" />
            </svg>
            <span className={label}>Export</span>
          </button>

          {/* Phones: name and size drop to their own row */}
          <div className="basis-full md:hidden" />

          <label className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none">
            <span className="field-label max-md:sr-only">Name</span>
            <CommitInput
              aria-label="Layout name"
              className="field w-full md:w-52"
              value={layout.name}
              onCommit={(name) => renameLayout(layout.id, name)}
            />
          </label>

          <div role="group" aria-label="Grid size" className="flex flex-col gap-1">
            <span className="field-label max-md:sr-only">Size</span>
            <div className="flex items-center gap-1 md:gap-2">
              <select
                aria-label="Grid size preset"
                className="field w-[6.75rem] pr-8 md:w-auto md:pr-9"
                value={presetValue}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    requestResize(Number(e.target.value), Number(e.target.value));
                  }
                }}
              >
                {SIZE_PRESETS.map((n) => (
                  <option key={n} value={n}>
                    {n}x{n}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
              <CommitInput
                aria-label="Grid width"
                type="number"
                inputMode="numeric"
                min={GRID_MIN_SIZE}
                max={GRID_MAX_SIZE}
                className="field w-14 px-1 text-center md:w-[4.5rem] md:px-3"
                value={String(layout.width)}
                onCommit={(text) => commitSide("width", text)}
              />
              <span aria-hidden className="text-ink-soft">
                ×
              </span>
              <CommitInput
                aria-label="Grid height"
                type="number"
                inputMode="numeric"
                min={GRID_MIN_SIZE}
                max={GRID_MAX_SIZE}
                className="field w-14 px-1 text-center md:w-[4.5rem] md:px-3"
                value={String(layout.height)}
                onCommit={(text) => commitSide("height", text)}
              />
            </div>
          </div>
        </>
      )}
      {drawerOpen && <LayoutsDrawer onClose={() => setDrawerOpen(false)} />}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </header>
  );
}
