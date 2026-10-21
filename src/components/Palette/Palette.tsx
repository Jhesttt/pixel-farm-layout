import type { PointerEvent as ReactPointerEvent } from "react";
import { useLibraryStore } from "../../store/libraryStore";
import { labelColorFor } from "../../theme/contrast";
import type { ObjectDefinition } from "../../types";

interface PaletteProps {
  onItemPointerDown: (e: ReactPointerEvent<HTMLElement>, def: ObjectDefinition) => void;
}

function PaletteItem({ def, onPointerDown }: { def: ObjectDefinition; onPointerDown: PaletteProps["onItemPointerDown"] }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`${def.name}, ${def.width} by ${def.height}. Drag onto the grid.`}
        className="flex w-full cursor-grab touch-none items-center gap-3 rounded-control px-2 py-2 text-left transition duration-150 ease-soft select-none hover:bg-wash active:cursor-grabbing"
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
          <span className="block text-xs text-ink-soft tabular-nums">
            {def.width} × {def.height}
            {def.effect ? ` · reach ${def.effect.width} × ${def.effect.height}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

function Group({ title, defs, onPointerDown }: { title: string; defs: ObjectDefinition[]; onPointerDown: PaletteProps["onItemPointerDown"] }) {
  if (defs.length === 0) return null;
  return (
    <section>
      <h3 className="field-label mb-1 px-2">{title}</h3>
      <ul className="flex flex-col gap-0.5">
        {defs.map((def) => (
          <PaletteItem key={def.id} def={def} onPointerDown={onPointerDown} />
        ))}
      </ul>
    </section>
  );
}

/** The objects you can drag onto the grid, grouped as built-in and custom. */
export default function Palette({ onItemPointerDown }: PaletteProps) {
  const definitions = useLibraryStore((s) => s.definitions);
  const builtIn = definitions.filter((d) => d.builtIn);
  const custom = definitions.filter((d) => !d.builtIn);

  return (
    <aside
      aria-label="Object palette"
      className="flex max-h-56 shrink-0 flex-col gap-4 overflow-y-auto border-b border-line bg-paper p-3 md:max-h-none md:w-64 md:border-r md:border-b-0"
    >
      <div className="px-2">
        <h2 className="text-lg font-semibold">Objects</h2>
        <p className="text-xs text-ink-soft">Drag onto the grid. Press R while dragging to rotate.</p>
      </div>
      <Group title="Built-in" defs={builtIn} onPointerDown={onItemPointerDown} />
      <Group title="Custom" defs={custom} onPointerDown={onItemPointerDown} />
    </aside>
  );
}
