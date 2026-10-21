import { useMemo, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { getFootprintSize } from "../../lib/grid";
import { useLibraryStore } from "../../store/libraryStore";
import { labelColorFor } from "../../theme/contrast";
import type { ObjectDefinition, PlacedObject } from "../../types";

interface ObjectLayerProps {
  objects: PlacedObject[];
  cellSize: number;
  selectedIds: string[];
  showLabels: boolean;
  /** An object being dragged: kept mounted (so pointer capture survives) but invisible. */
  hiddenObjectId?: string | null;
  onObjectPointerDown?: (e: ReactPointerEvent<HTMLElement>, obj: PlacedObject) => void;
  /** Keyboard activation (Enter / Space) of an object. */
  onObjectActivate?: (e: ReactKeyboardEvent<HTMLElement>, obj: PlacedObject) => void;
}

const MIN_PX_FOR_ICON = 20;
const MIN_PX_FOR_LABEL = 40;
const MAX_ICON_PX = 40;

function describe(obj: PlacedObject, def: ObjectDefinition): string {
  const name = obj.label ? `${def.name}, ${obj.label}` : def.name;
  return `${name} at column ${obj.x}, row ${obj.y}`;
}

/** Placed objects as absolutely positioned boxes, one cell = `cellSize` px. */
export default function ObjectLayer({
  objects,
  cellSize,
  selectedIds,
  showLabels,
  hiddenObjectId = null,
  onObjectPointerDown,
  onObjectActivate,
}: ObjectLayerProps) {
  const definitions = useLibraryStore((s) => s.definitions);
  const defsById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  return (
    <>
      {objects.map((obj) => {
        const def = defsById.get(obj.defId);
        if (!def) return null;

        const { width, height } = getFootprintSize(obj, def);
        const pxW = width * cellSize;
        const pxH = height * cellSize;
        const fill = obj.colorOverride ?? def.color;
        const selected = selectedIds.includes(obj.id);
        const showIcon = def.icon !== undefined && Math.min(pxW, pxH) >= MIN_PX_FOR_ICON;
        const showLabel =
          showLabels && obj.label !== undefined && obj.label !== "" && pxW >= MIN_PX_FOR_LABEL;

        return (
          <div
            key={obj.id}
            data-object-id={obj.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={describe(obj, def)}
            className={`absolute flex cursor-grab touch-none flex-col items-center justify-center overflow-hidden rounded-[3px] ring-2 ring-inset ring-ink-deep/70 select-none ${
              selected ? "z-10 outline-[3px] outline-offset-2 outline-primary" : ""
            }`}
            onPointerDown={onObjectPointerDown && ((e) => onObjectPointerDown(e, obj))}
            onKeyDown={onObjectActivate && ((e) => onObjectActivate(e, obj))}
            style={{
              left: obj.x * cellSize,
              top: obj.y * cellSize,
              width: pxW,
              height: pxH,
              backgroundColor: fill,
              color: labelColorFor(fill),
              opacity: obj.id === hiddenObjectId ? 0 : 1,
            }}
          >
            {showIcon && (
              <span
                aria-hidden
                className="leading-none select-none"
                style={{ fontSize: Math.min(MAX_ICON_PX, Math.min(pxW, pxH) * 0.5) }}
              >
                {def.icon}
              </span>
            )}
            {showLabel && (
              <span className="max-w-full truncate px-1 text-xs leading-tight font-bold">{obj.label}</span>
            )}
          </div>
        );
      })}
    </>
  );
}
