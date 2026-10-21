import { useState } from "react";
import {
  GRID_MAX_SIZE,
  GRID_MIN_SIZE,
  GRID_SIZE_PRESETS,
  clampGridSize,
  getObjectsOutsideSize,
} from "../lib/grid";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import BrandMark from "./BrandMark";
import CommitInput from "./CommitInput";
import ExportDialog from "./ExportDialog";
import LayoutsDrawer from "./LayoutsDrawer";

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
    layout && layout.width === layout.height && (GRID_SIZE_PRESETS as readonly number[]).includes(layout.width)
      ? String(layout.width)
      : "custom";

  // Everything sits on one centre line at one height (h-9; h-10 touch targets on phones).
  // Below xl the bar is two rows: brand, actions and Export on top, the layout's name and size
  // underneath. From xl it is one row: brand | actions ......... name, size | Export.
  const iconOnly = "max-md:w-10 max-md:px-0";
  const label = "max-md:sr-only";
  const segment =
    "flex h-10 items-center justify-center gap-2 px-3 text-sm font-semibold transition duration-150 ease-soft hover:bg-wash disabled:opacity-60 disabled:hover:bg-transparent focus-visible:outline-offset-[-3px] md:h-9 max-md:w-10 max-md:px-0";

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-paper px-3 py-2 md:px-5 xl:h-16 xl:flex-nowrap xl:py-0">
      <div className="flex items-center gap-2 text-primary-strong md:gap-3">
        <BrandMark />
        <h1 className="text-xl leading-none font-semibold text-ink md:text-2xl">Pixel Farm</h1>
        <span aria-hidden className="ml-2 hidden h-6 w-px bg-line xl:block" />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Layouts"
          className={`btn btn-secondary ${iconOnly} max-md:h-10`}
          onClick={() => setDrawerOpen(true)}
        >
          <svg {...iconProps}>
            <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
          </svg>
          <span className={label}>Layouts</span>
        </button>

        {layout && (
          <div
            role="group"
            aria-label="History"
            className="inline-flex overflow-hidden rounded-control border border-control-edge bg-paper"
          >
            <button type="button" aria-label="Undo" className={segment} disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={undo}>
              <svg {...iconProps}>
                <path d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H6M3.5 6.5l3-3M3.5 6.5l3 3" />
              </svg>
              <span className={label}>Undo</span>
            </button>
            <span aria-hidden className="w-px bg-control-edge" />
            <button type="button" aria-label="Redo" className={segment} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={redo}>
              <span className={label}>Redo</span>
              <svg {...iconProps}>
                <path d="M12.5 6.5h-6a3.5 3.5 0 0 0 0 7H10M12.5 6.5l-3-3M12.5 6.5l-3 3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {layout && (
        <>
          <div className="order-3 flex basis-full items-center gap-x-4 gap-y-2 xl:ml-auto xl:basis-auto">
            <label className="flex min-w-0 flex-1 items-center gap-2 md:max-w-xs xl:flex-none">
              <span className="field-label max-md:sr-only">Name</span>
              <CommitInput
                aria-label="Layout name"
                className="field w-full xl:w-52"
                value={layout.name}
                onCommit={(name) => renameLayout(layout.id, name)}
              />
            </label>

            <div role="group" aria-label="Grid size" className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <span className="field-label max-md:sr-only">Size</span>
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
                {GRID_SIZE_PRESETS.map((n) => (
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

          <div className="order-2 ml-auto flex items-center gap-3 xl:order-4 xl:ml-0">
            <span aria-hidden className="hidden h-6 w-px bg-line xl:block" />
            <button type="button" aria-label="Export" className={`btn btn-secondary ${iconOnly} max-md:h-10`} onClick={() => setExportOpen(true)}>
              <svg {...iconProps}>
                <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13h10" />
              </svg>
              <span className={label}>Export</span>
            </button>
          </div>
        </>
      )}
      {drawerOpen && <LayoutsDrawer onClose={() => setDrawerOpen(false)} />}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </header>
  );
}
