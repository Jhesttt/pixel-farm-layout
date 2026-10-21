import { useEffect, useState } from "react";
import { GRID_MAX_SIZE, GRID_MIN_SIZE, clampGridSize, getObjectsOutsideSize } from "../lib/grid";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";

const SIZE_PRESETS = [15, 17, 20, 24, 32];
const DEFAULT_SIZE = 17;

const inputClass =
  "rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const buttonClass =
  "rounded border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40";

/** Text input that edits locally and commits on blur / Enter; Escape reverts. */
function CommitInput({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "onKeyDown">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
    else setDraft(value);
  };

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

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
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-300 bg-stone-100 px-4 py-2">
      <h1 className="text-base font-semibold text-emerald-800">Pixel Farm</h1>

      {/* Temporary switcher until the LayoutsDrawer (step 10) */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Saved layouts"
          className={inputClass}
          value={layout?.id ?? ""}
          onChange={(e) => setActiveLayout(e.target.value)}
        >
          {sortedLayouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.width}x{l.height})
            </option>
          ))}
        </select>
        <button
          type="button"
          className={buttonClass}
          onClick={() => createLayout(`Farm ${sortedLayouts.length + 1}`, DEFAULT_SIZE, DEFAULT_SIZE)}
        >
          + New
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!layout}
          onClick={() => {
            if (layout && window.confirm(`Delete "${layout.name}"? This cannot be undone.`)) {
              deleteLayout(layout.id);
            }
          }}
        >
          Delete
        </button>
      </div>

      {layout && (
        <>
          <label className="flex items-center gap-2 text-sm">
            Name
            <CommitInput
              aria-label="Layout name"
              className={`${inputClass} w-48`}
              value={layout.name}
              onCommit={(name) => renameLayout(layout.id, name)}
            />
          </label>

          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              Size
              <select
                aria-label="Grid size preset"
                className={inputClass}
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
            </label>
            <CommitInput
              aria-label="Grid width"
              type="number"
              inputMode="numeric"
              min={GRID_MIN_SIZE}
              max={GRID_MAX_SIZE}
              className={`${inputClass} w-16`}
              value={String(layout.width)}
              onCommit={(text) => commitSide("width", text)}
            />
            <span aria-hidden>x</span>
            <CommitInput
              aria-label="Grid height"
              type="number"
              inputMode="numeric"
              min={GRID_MIN_SIZE}
              max={GRID_MAX_SIZE}
              className={`${inputClass} w-16`}
              value={String(layout.height)}
              onCommit={(text) => commitSide("height", text)}
            />
          </div>
        </>
      )}
    </header>
  );
}
