import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useCellSize } from "../../hooks/useCellSize";
import { PHONE_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { selectActiveLayout, useLayoutStore } from "../../store/layoutStore";
import NoLayoutsState from "../NoLayoutsState";
import type { DragState } from "../../hooks/useGridDrag";
import EffectLayer from "./EffectLayer";
import GridLayer from "./GridLayer";
import ObjectLayer from "./ObjectLayer";
import type { PlacedObject } from "../../types";

// Phones get tighter spacing so the board gets the room.
const SPACING = {
  desktop: { ruler: 24, padding: 24, card: 16 },
  phone: { ruler: 20, padding: 8, card: 8 },
};

interface GridCanvasProps {
  /** Origin of cell (0, 0); the drag hook converts pointer positions against it. */
  gridRef: RefObject<HTMLDivElement>;
  /** The drag in progress, if any: hides the dragged object and previews its effect. */
  drag: DragState | null;
  onObjectPointerDown: (e: ReactPointerEvent<HTMLElement>, obj: PlacedObject) => void;
  onObjectActivate: (e: ReactKeyboardEvent<HTMLElement>, obj: PlacedObject) => void;
}

export default function GridCanvas({
  gridRef,
  drag,
  onObjectPointerDown,
  onObjectActivate,
}: GridCanvasProps) {
  const hiddenObjectId = drag?.objectId ?? null;
  const layout = useLayoutStore(selectActiveLayout);
  const selection = useLayoutStore((s) => s.selection);
  const view = useLayoutStore((s) => s.view);
  const setSelection = useLayoutStore((s) => s.setSelection);
  const containerRef = useRef<HTMLDivElement>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const { ruler: RULER_SIZE, padding: PADDING, card: CARD_PADDING } = phone ? SPACING.phone : SPACING.desktop;
  const cellSize = useCellSize(
    containerRef,
    layout?.width ?? 1,
    RULER_SIZE + CARD_PADDING * 2 + PADDING * 2,
  );

  if (!layout) return <NoLayoutsState />;

  const pixelWidth = layout.width * cellSize;
  const pixelHeight = layout.height * cellSize;
  const cardWidth = CARD_PADDING * 2 + RULER_SIZE + pixelWidth;

  return (
    <div
      ref={containerRef}
      data-board-scroller
      className="order-1 min-h-0 flex-1 overflow-auto md:order-2"
      style={{ padding: PADDING }}
    >
      <div className="mx-auto" style={{ width: cardWidth }}>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="truncate text-lg font-semibold md:text-xl">{layout.name}</h2>
          <p className="shrink-0 text-ink-soft tabular-nums">
            {layout.width} × {layout.height} tiles
          </p>
        </div>
        <div className="rounded-card bg-paper shadow-soft" style={{ padding: CARD_PADDING }}>
          <div
            className="relative"
            style={{ width: RULER_SIZE + pixelWidth, height: RULER_SIZE + pixelHeight }}
          >
            <div
              ref={gridRef}
              className="absolute"
              style={{ left: RULER_SIZE, top: RULER_SIZE, width: pixelWidth, height: pixelHeight }}
              onPointerDown={(e) => {
                // A press on bare board (not on an object) clears the selection.
                const onObject = (e.target as HTMLElement).closest("[data-object-id]");
                if (!onObject && !e.shiftKey && !e.ctrlKey && !e.metaKey) setSelection([]);
              }}
            >
              <GridLayer
                width={layout.width}
                height={layout.height}
                cellSize={cellSize}
                rulerSize={RULER_SIZE}
                showGrid={view.showGrid}
              />
              {view.showEffects && (
                <EffectLayer
                  layout={layout}
                  cellSize={cellSize}
                  hiddenObjectId={hiddenObjectId}
                  preview={
                    drag?.overGrid
                      ? { defId: drag.defId, x: drag.x, y: drag.y, rotation: drag.rotation }
                      : null
                  }
                />
              )}
              <ObjectLayer
                objects={layout.objects}
                cellSize={cellSize}
                selectedIds={selection}
                showLabels={view.showLabels}
                hiddenObjectId={hiddenObjectId}
                onObjectPointerDown={onObjectPointerDown}
                onObjectActivate={onObjectActivate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
