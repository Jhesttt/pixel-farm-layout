import { useMemo } from "react";
import { EFFECT_FILL_ALPHA, MIN_STACK_FOR_COUNT, effectPatternIndex } from "../../lib/effectStyle";
import { getCellBounds, getEffectCells, getEffectCoverage } from "../../lib/grid";
import { useLibraryStore } from "../../store/libraryStore";
import { effectEdgeColor } from "../../theme/contrast";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../../types";

export interface EffectPreview {
  defId: string;
  x: number;
  y: number;
  rotation: PlacedObject["rotation"];
}

interface EffectLayerProps {
  layout: FarmLayout;
  cellSize: number;
  /** Object being dragged: its placed effect is hidden while a preview follows the ghost. */
  hiddenObjectId: string | null;
  /** Effect of an object mid-drag, drawn where it would land. */
  preview: EffectPreview | null;
}

const MIN_PX_FOR_COUNT = 24;
function Pattern({ id, kind, color }: { id: string; kind: number; color: string }) {
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
      {kind === 0 && <path d="M-2 2 2 -2M0 8 8 0M6 10 10 6" stroke={color} strokeWidth="1.3" />}
      {kind === 1 && <path d="M-2 6 2 10M0 0 8 8M6 -2 10 2" stroke={color} strokeWidth="1.3" />}
      {kind === 2 && <circle cx="4" cy="4" r="1.3" fill={color} />}
    </pattern>
  );
}

interface Area {
  key: string;
  def: ObjectDefinition;
  bounds: { x: number; y: number; width: number; height: number };
  preview: boolean;
}

/**
 * Areas of effect under the objects. Each is a tinted, textured rectangle with a dashed outline,
 * so it never reads as an object or the drag ghost. Overlaps stack: the tints add up and cells
 * covered two or more times carry a count.
 */
export default function EffectLayer({ layout, cellSize, hiddenObjectId, preview }: EffectLayerProps) {
  const definitions = useLibraryStore((s) => s.definitions);

  const { areas, stacked } = useMemo(() => {
    const defsById = new Map(definitions.map((d) => [d.id, d]));
    const visible = layout.objects.filter((o) => o.id !== hiddenObjectId);
    const areas: Area[] = [];

    for (const obj of visible) {
      const def = defsById.get(obj.defId);
      if (!def?.effect || !obj.showEffect) continue;
      const bounds = getCellBounds(getEffectCells(obj, def, layout));
      if (bounds) areas.push({ key: obj.id, def, bounds, preview: false });
    }

    const previewDef = preview ? defsById.get(preview.defId) : undefined;
    if (preview && previewDef?.effect) {
      const probe: PlacedObject = { id: "preview", ...preview, showEffect: true };
      const bounds = getCellBounds(getEffectCells(probe, previewDef, layout));
      if (bounds) areas.push({ key: "preview", def: previewDef, bounds, preview: true });
    }

    const coverage = getEffectCoverage({ ...layout, objects: visible }, definitions);
    const stacked = [...coverage.entries()]
      .filter(([, n]) => n >= MIN_STACK_FOR_COUNT)
      .map(([cell, n]) => {
        const [x, y] = cell.split(",").map(Number) as [number, number];
        return { x, y, n };
      });
    return { areas, stacked };
  }, [layout, definitions, hiddenObjectId, preview]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {areas.map(({ key, def, bounds, preview: isPreview }) => {
        const effect = def.effect as NonNullable<ObjectDefinition["effect"]>;
        const edge = effectEdgeColor(effect.color);
        const patternId = `pfl-fx-${key}`;
        const width = bounds.width * cellSize;
        const height = bounds.height * cellSize;
        return (
          <div
            key={key}
            className="absolute rounded-[3px]"
            style={{
              left: bounds.x * cellSize,
              top: bounds.y * cellSize,
              width,
              height,
              // A real translucent fill, so overlapping areas darken each other.
              backgroundColor: `color-mix(in srgb, ${effect.color} ${Math.round(EFFECT_FILL_ALPHA * 100)}%, transparent)`,
            }}
          >
            <svg className="absolute inset-0" width={width} height={height}>
              <defs>
                <Pattern id={patternId} kind={effectPatternIndex(def.id)} color={edge} />
              </defs>
              <rect width={width} height={height} fill={`url(#${patternId})`} opacity="0.4" />
            </svg>
            <div
              className="absolute inset-0 rounded-[3px] border-2 border-dashed"
              style={{ borderColor: edge, borderStyle: isPreview ? "dotted" : "dashed" }}
            />
          </div>
        );
      })}

      {cellSize >= MIN_PX_FOR_COUNT &&
        stacked.map(({ x, y, n }) => (
          <span
            key={`${x},${y}`}
            className="absolute flex items-start justify-end p-0.5 text-[11px] leading-none font-bold text-ink-deep tabular-nums"
            style={{ left: x * cellSize, top: y * cellSize, width: cellSize, height: cellSize }}
          >
            <span className="rounded-full bg-paper px-1 py-px ring-1 ring-ink-deep/40">×{n}</span>
          </span>
        ))}
    </div>
  );
}
