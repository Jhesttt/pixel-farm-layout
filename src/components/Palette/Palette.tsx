import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { withBuiltInsReset } from "../../data/builtIns";
import { countDefinitionUse, findMisfits } from "../../lib/edit";
import { useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import { labelColorFor } from "../../theme/contrast";
import type { ObjectDefinition } from "../../types";
import ObjectDefEditor from "./ObjectDefEditor";

interface PaletteProps {
  onItemPointerDown: (e: ReactPointerEvent<HTMLElement>, def: ObjectDefinition) => void;
  /** On phones the palette shares a dock with the inspector; this hides it while that is showing. */
  hiddenOnMobile?: boolean;
}

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
  "flex h-9 w-9 items-center justify-center rounded-control text-ink-soft transition duration-150 ease-soft hover:bg-wash hover:text-ink md:h-8 md:w-8";

interface ItemProps {
  def: ObjectDefinition;
  onPointerDown: PaletteProps["onItemPointerDown"];
  onEdit: (def: ObjectDefinition) => void;
  onDelete: (def: ObjectDefinition) => void;
}

/**
 * One object. On phones it is a tile in a sideways-scrolling strip: touch-action is pan-x, so a
 * horizontal swipe scrolls the strip while a vertical drag lifts the object toward the board. On
 * larger screens it is a row in a vertical list.
 */
function PaletteItem({ def, onPointerDown, onEdit, onDelete }: ItemProps) {
  return (
    <li className="flex w-28 shrink-0 flex-col rounded-control transition duration-150 ease-soft hover:bg-wash md:w-auto md:flex-row md:items-center">
      <button
        type="button"
        aria-label={`${def.name}, ${def.width} by ${def.height}. Drag onto the grid.`}
        className="flex min-w-0 cursor-grab touch-pan-x flex-col items-center gap-1 rounded-control px-2 py-2 text-center select-none active:cursor-grabbing md:flex-1 md:touch-none md:flex-row md:gap-3 md:text-left"
        onPointerDown={(e) => onPointerDown(e, def)}
      >
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-xl leading-none ring-2 ring-inset ring-ink-deep/70 md:h-9 md:w-9 md:text-lg"
          style={{ backgroundColor: def.color, color: labelColorFor(def.color) }}
        >
          {def.icon}
        </span>
        <span className="max-w-full min-w-0 md:flex-1">
          <span className="block truncate font-semibold">{def.name}</span>
          <span className="block truncate text-xs text-ink-soft tabular-nums">
            {def.width}×{def.height}
            {def.effect ? ` · reach ${def.effect.width}×${def.effect.height}` : ""}
          </span>
        </span>
      </button>
      <div className="flex justify-center md:contents">
        <button type="button" aria-label={`Edit ${def.name}`} title="Edit" className={iconButton} onClick={() => onEdit(def)}>
          <svg {...iconProps}>
            <path d="M2.5 13.5v-2.6l7.8-7.8 2.6 2.6-7.8 7.8h-2.6ZM9 4.4l2.6 2.6" />
          </svg>
        </button>
        <button type="button" aria-label={`Delete ${def.name}`} title="Delete" className={`${iconButton} md:mr-1`} onClick={() => onDelete(def)}>
          <svg {...iconProps}>
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
          </svg>
        </button>
      </div>
    </li>
  );
}

/** A titled list on desktop. On phones the groups run together in one sideways strip, so no title. */
function Group({ title, defs, ...rest }: { title: string; defs: ObjectDefinition[] } & Omit<ItemProps, "def">) {
  if (defs.length === 0) return null;
  return (
    <section className="flex shrink-0 gap-1 md:block md:shrink">
      {/* sr-only is absolutely positioned; the strip is `relative` so it clips it instead of widening the page */}
      <h3 className="field-label mb-1 px-2 max-md:sr-only">{title}</h3>
      <ul className="flex gap-1 md:flex-col md:gap-0.5">
        {defs.map((def) => (
          <PaletteItem key={def.id} def={def} {...rest} />
        ))}
      </ul>
    </section>
  );
}

/** The objects you can drag onto the grid, grouped as built-in and custom, with a definition editor. */
export default function Palette({ onItemPointerDown, hiddenOnMobile = false }: PaletteProps) {
  const definitions = useLibraryStore((s) => s.definitions);
  const deleteDefinition = useLibraryStore((s) => s.deleteDefinition);
  const resetBuiltIns = useLibraryStore((s) => s.resetBuiltIns);
  const [editing, setEditing] = useState<ObjectDefinition | "new" | null>(null);

  const builtIn = definitions.filter((d) => d.builtIn);
  const custom = definitions.filter((d) => !d.builtIn);

  const requestDelete = (def: ObjectDefinition) => {
    const use = countDefinitionUse(useLayoutStore.getState().layouts, def.id);
    const message =
      use.objects > 0
        ? `Delete "${def.name}"? It is placed ${use.objects} ${use.objects === 1 ? "time" : "times"} in ${use.layouts} ${use.layouts === 1 ? "layout" : "layouts"}, and ${use.objects === 1 ? "that placement" : "those placements"} will be removed too.`
        : `Delete "${def.name}"?`;
    if (!window.confirm(message)) return;
    useLayoutStore.getState().removeObjectsByDef(def.id);
    deleteDefinition(def.id);
    // An undo could otherwise bring back objects whose definition no longer exists.
    useLayoutStore.getState().clearHistory();
  };

  const requestReset = () => {
    const restored = withBuiltInsReset(useLibraryStore.getState().definitions);
    const doomed = Object.values(useLayoutStore.getState().layouts).reduce(
      (n, l) => n + findMisfits(l, restored).length,
      0,
    );
    const warning =
      doomed > 0
        ? ` Restoring the original sizes means ${doomed === 1 ? "1 placed object no longer fits" : `${doomed} placed objects no longer fit`} and will be removed.`
        : "";
    if (!window.confirm(`Restore all built-in objects to their originals? Your custom objects are kept.${warning}`)) {
      return;
    }
    resetBuiltIns();
    useLayoutStore.getState().removeMisfitObjects(useLibraryStore.getState().definitions);
    useLayoutStore.getState().clearHistory(); // sizes may have changed back
  };

  return (
    <aside
      aria-label="Object palette"
      className={`${hiddenOnMobile ? "hidden" : "flex"} min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 md:order-1 md:flex md:w-64 md:flex-none md:shrink-0 md:gap-4 md:border-r md:border-line md:bg-paper`}
    >
      <div className="flex items-center justify-between gap-2 px-2 md:block">
        <div>
          <h2 className="text-lg font-semibold">Objects</h2>
          <p className="hidden text-xs text-ink-soft md:block">Drag onto the grid. Press R while dragging to rotate.</p>
          <p className="text-xs text-ink-soft md:hidden">Drag an object up onto the grid.</p>
        </div>
        <button type="button" className="btn btn-primary md:mt-3 md:w-full" onClick={() => setEditing("new")}>
          <svg {...iconProps}>
            <path d="M8 3v10M3 8h10" />
          </svg>
          New object
        </button>
      </div>
      <div className="relative flex gap-3 overflow-x-auto pb-1 md:flex-col md:gap-4 md:overflow-visible md:pb-0">
        <Group title="Built-in" defs={builtIn} onPointerDown={onItemPointerDown} onEdit={setEditing} onDelete={requestDelete} />
        <Group title="Custom" defs={custom} onPointerDown={onItemPointerDown} onEdit={setEditing} onDelete={requestDelete} />
      </div>
      <button type="button" className="btn btn-secondary md:mt-auto" onClick={requestReset}>
        Reset built-ins
      </button>

      {editing !== null && (
        <ObjectDefEditor
          key={editing === "new" ? "new" : editing.id}
          definition={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  );
}
