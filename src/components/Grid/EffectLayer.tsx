import { useMemo } from "react";
import { EFFECT_FILL_ALPHA, effectPatternIndex } from "../../lib/effectStyle";
import { computeEffectAreas, type EffectPreview } from "../../lib/effects";
import { useLibraryStore } from "../../store/libraryStore";
import { effectEdgeColor } from "../../theme/contrast";
import EffectPattern from "./EffectPattern";
import type { FarmLayout, ObjectDefinition } from "../../types";

export type { EffectPreview };

interface EffectLayerProps {
  layout: FarmLayout;
  cellSize: number;
  /** Object being dragged: its placed effect is hidden while a preview follows the ghost. */
  hiddenObjectId: string | null;
  /** Effect of an object mid-drag, drawn where it would land. */
  preview: EffectPreview | null;
}

const MIN_PX_FOR_COUNT = 24;
/**
 * Areas of effect under the objects. Each is a tinted, textured rectangle with a dashed outline,
 * so it never reads as an object or the drag ghost. Overlaps stack: the tints add up and cells
 * covered two or more times carry a count.
 */
export default function EffectLayer({ layout, cellSize, hiddenObjectId, preview }: EffectLayerProps) {
  const definitions = useLibraryStore((s) => s.definitions);

  const { areas, stacked } = useMemo(
    () => computeEffectAreas(layout, definitions, hiddenObjectId, preview),
    [layout, definitions, hiddenObjectId, preview],
  );

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
                <EffectPattern id={patternId} kind={effectPatternIndex(def.id)} color={edge} />
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
