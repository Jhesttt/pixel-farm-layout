import { useRef } from "react";
import { useCellSize } from "../../hooks/useCellSize";
import { selectActiveLayout, useLayoutStore } from "../../store/layoutStore";
import GridLayer from "./GridLayer";

const RULER_SIZE = 20;
const PADDING = 16;

export default function GridCanvas() {
  const layout = useLayoutStore(selectActiveLayout);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellSize = useCellSize(containerRef, layout?.width ?? 1, RULER_SIZE + PADDING * 2);

  if (!layout) {
    return <div className="flex flex-1 items-center justify-center text-stone-500">No layout selected</div>;
  }

  const pixelWidth = layout.width * cellSize;
  const pixelHeight = layout.height * cellSize;

  return (
    <div ref={containerRef} className="flex-1 overflow-auto" style={{ padding: PADDING }}>
      <div
        className="relative mx-auto"
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
          {/* EffectLayer, ObjectLayer and DragGhost mount here in later steps */}
        </div>
      </div>
    </div>
  );
}
