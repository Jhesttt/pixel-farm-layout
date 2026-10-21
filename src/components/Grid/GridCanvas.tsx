import { useMemo, useRef } from "react";
import { sampleObjectsFor } from "../../data/sampleObjects";
import { useCellSize } from "../../hooks/useCellSize";
import { selectActiveLayout, useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import NoLayoutsState from "../NoLayoutsState";
import GridLayer from "./GridLayer";
import ObjectLayer from "./ObjectLayer";

const RULER_SIZE = 24;
const PADDING = 24; // around the board card
const CARD_PADDING = 16; // inside the board card

export default function GridCanvas() {
  const layout = useLayoutStore(selectActiveLayout);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const definitions = useLibraryStore((s) => s.definitions);
  const cellSize = useCellSize(
    containerRef,
    layout?.width ?? 1,
    RULER_SIZE + CARD_PADDING * 2 + PADDING * 2,
  );

  // Step 4 only: an empty layout shows hardcoded samples so sizing and rotation can be checked.
  // Removed in step 5, when objects come from dragging.
  const objects = useMemo(
    () => (layout && layout.objects.length === 0 ? sampleObjectsFor(layout, definitions) : (layout?.objects ?? [])),
    [layout, definitions],
  );

  if (!layout) return <NoLayoutsState />;

  const pixelWidth = layout.width * cellSize;
  const pixelHeight = layout.height * cellSize;
  const cardWidth = CARD_PADDING * 2 + RULER_SIZE + pixelWidth;

  return (
    <div ref={containerRef} className="flex-1 overflow-auto" style={{ padding: PADDING }}>
      <div className="mx-auto" style={{ width: cardWidth }}>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="truncate text-xl font-semibold">{layout.name}</h2>
          <p className="shrink-0 text-ink-soft tabular-nums">
            {layout.width} × {layout.height} tiles
          </p>
        </div>
        <div className="rounded-card bg-paper shadow-soft" style={{ padding: CARD_PADDING }}>
          <div
            className="relative"
            style={{ width: RULER_SIZE + pixelWidth, height: RULER_SIZE + pixelHeight }}
          >
            {/* gridRef is the origin for pointer-to-cell conversion in the drag hook (step 5) */}
            <div
              ref={gridRef}
              className="absolute"
              style={{ left: RULER_SIZE, top: RULER_SIZE, width: pixelWidth, height: pixelHeight }}
            >
              <GridLayer
                width={layout.width}
                height={layout.height}
                cellSize={cellSize}
                rulerSize={RULER_SIZE}
              />
              <ObjectLayer objects={objects} cellSize={cellSize} />
              {/* EffectLayer and DragGhost mount here in later steps */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
