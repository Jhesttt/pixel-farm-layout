import { GRID_MAX_SIZE, GRID_MIN_SIZE, clampGridSize, getObjectsOutsideSize } from "../lib/grid";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import BrandMark from "./BrandMark";
import CommitInput from "./CommitInput";

const SIZE_PRESETS = [15, 17, 20, 24, 32];
const DEFAULT_SIZE = 17;

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
  const layouts = useLayoutStore((s) => s.layouts);
  const createLayout = useLayoutStore((s) => s.createLayout);
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const deleteLayout = useLayoutStore((s) => s.deleteLayout);
  const renameLayout = useLayoutStore((s) => s.renameLayout);
  const resizeLayout = useLayoutStore((s) => s.resizeLayout);
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

  const sortedLayouts = Object.values(layouts).sort((a, b) => b.updatedAt - a.updatedAt);
  const presetValue =
    layout && layout.width === layout.height && SIZE_PRESETS.includes(layout.width)
      ? String(layout.width)
      : "custom";

  return (
    <header className="flex min-h-20 flex-wrap items-end gap-x-6 gap-y-3 border-b border-line bg-paper px-5 py-3">
      <div className="flex items-center gap-3 self-center text-primary-strong">
        <BrandMark />
        <h1 className="text-2xl leading-none font-semibold text-ink">Pixel Farm</h1>
      </div>

      {/* Temporary switcher until the LayoutsDrawer (step 10) */}
      <div className="flex flex-wrap items-end gap-2">
        {sortedLayouts.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="field-label">Layout</span>
            <select
              aria-label="Saved layouts"
              className="field min-w-44"
              value={layout?.id ?? ""}
              onChange={(e) => setActiveLayout(e.target.value)}
            >
              {sortedLayouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.width}x{l.height})
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => createLayout(`Farm ${sortedLayouts.length + 1}`, DEFAULT_SIZE, DEFAULT_SIZE)}
        >
          <svg {...iconProps}>
            <path d="M8 3v10M3 8h10" />
          </svg>
          New layout
        </button>
        {layout && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm(`Delete "${layout.name}"? This cannot be undone.`)) {
                deleteLayout(layout.id);
              }
            }}
          >
            <svg {...iconProps}>
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
            </svg>
            Delete
          </button>
        )}
      </div>

      {layout && (
        <>
          <label className="flex flex-col gap-1">
            <span className="field-label">Name</span>
            <CommitInput
              aria-label="Layout name"
              className="field w-52"
              value={layout.name}
              onCommit={(name) => renameLayout(layout.id, name)}
            />
          </label>

          <div role="group" aria-label="Grid size" className="flex flex-col gap-1">
            <span className="field-label">Size</span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Grid size preset"
                className="field"
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
                className="field w-[4.5rem] text-center"
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
                className="field w-[4.5rem] text-center"
                value={String(layout.height)}
                onCommit={(text) => commitSide("height", text)}
              />
            </div>
          </div>
        </>
      )}
    </header>
  );
}
