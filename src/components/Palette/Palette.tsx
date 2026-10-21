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
  "flex h-8 w-8 items-center justify-center rounded-control text-ink-soft transition duration-150 ease-soft hover:bg-wash hover:text-ink";

interface ItemProps {
  def: ObjectDefinition;
  onPointerDown: PaletteProps["onItemPointerDown"];
  onEdit: (def: ObjectDefinition) => void;
  onDelete: (def: ObjectDefinition) => void;
}

function PaletteItem({ def, onPointerDown, onEdit, onDelete }: ItemProps) {
  return (
    <li className="flex items-center rounded-control transition duration-150 ease-soft hover:bg-wash">
      <button
        type="button"
        aria-label={`${def.name}, ${def.width} by ${def.height}. Drag onto the grid.`}
        className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-3 rounded-control px-2 py-2 text-left select-none active:cursor-grabbing"
        onPointerDown={(e) => onPointerDown(e, def)}
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-lg leading-none ring-2 ring-inset ring-ink-deep/70"
          style={{ backgroundColor: def.color, color: labelColorFor(def.color) }}
        >
          {def.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{def.name}</span>
          <span className="block truncate text-xs text-ink-soft tabular-nums">
            {def.width} × {def.height}
            {def.effect ? ` · reach ${def.effect.width} × ${def.effect.height}` : ""}
          </span>
        </span>
      </button>
      <button type="button" aria-label={`Edit ${def.name}`} title="Edit" className={iconButton} onClick={() => onEdit(def)}>
        <svg {...iconProps}>
          <path d="M2.5 13.5v-2.6l7.8-7.8 2.6 2.6-7.8 7.8h-2.6ZM9 4.4l2.6 2.6" />
        </svg>
      </button>
      <button type="button" aria-label={`Delete ${def.name}`} title="Delete" className={`${iconButton} mr-1`} onClick={() => onDelete(def)}>
        <svg {...iconProps}>
          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
        </svg>
      </button>
    </li>
  );
}

function Group({ title, defs, ...rest }: { title: string; defs: ObjectDefinition[] } & Omit<ItemProps, "def">) {
  if (defs.length === 0) return null;
  return (
    <section>
      <h3 className="field-label mb-1 px-2">{title}</h3>
      <ul className="flex flex-col gap-0.5">
        {defs.map((def) => (
          <PaletteItem key={def.id} def={def} {...rest} />
        ))}
      </ul>
    </section>
  );
}

/** The objects you can drag onto the grid, grouped as built-in and custom, with a definition editor. */
export default function Palette({ onItemPointerDown }: PaletteProps) {
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
      className="flex max-h-56 shrink-0 flex-col gap-4 overflow-y-auto border-b border-line bg-paper p-3 md:max-h-none md:w-64 md:border-r md:border-b-0"
    >
      <div className="px-2">
        <h2 className="text-lg font-semibold">Objects</h2>
        <p className="text-xs text-ink-soft">Drag onto the grid. Press R while dragging to rotate.</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
        <svg {...iconProps}>
          <path d="M8 3v10M3 8h10" />
        </svg>
        New object
      </button>
      <Group title="Built-in" defs={builtIn} onPointerDown={onItemPointerDown} onEdit={setEditing} onDelete={requestDelete} />
      <Group title="Custom" defs={custom} onPointerDown={onItemPointerDown} onEdit={setEditing} onDelete={requestDelete} />
      <button type="button" className="btn btn-secondary mt-auto" onClick={requestReset}>
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
