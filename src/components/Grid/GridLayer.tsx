interface GridLayerProps {
  width: number;
  height: number;
  cellSize: number;
  /** Space reserved outside the grid on the top and left for the coordinate labels. */
  rulerSize: number;
}

const MAJOR_EVERY = 5;
const MIN_CELL_FOR_ALL_LABELS = 24;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * The board: a parchment ground with cell lines (every fifth one stronger, to count cells at a
 * glance) and coordinates on the top and left edges.
 */
export default function GridLayer({ width, height, cellSize, rulerSize }: GridLayerProps) {
  const pixelWidth = width * cellSize;
  const pixelHeight = height * cellSize;

  // 1px lines at the given cell indices, snapped to the pixel grid for crisp edges. The outer
  // edge is the board's frame, so only interior lines are drawn.
  const axisPath = (indices: number[], axis: "x" | "y") =>
    indices
      .map((i) => {
        const p = i * cellSize + 0.5;
        return axis === "x" ? `M${p} 0V${pixelHeight}` : `M0 ${p}H${pixelWidth}`;
      })
      .join("");
  const interior = (n: number) => range(n).slice(1);
  const isMajor = (i: number) => i % MAJOR_EVERY === 0;
  // Small cells cannot fit every number, so label only the major lines there.
  const showLabel = (i: number) => cellSize >= MIN_CELL_FOR_ALL_LABELS || isMajor(i);
  const minorPath =
    axisPath(interior(width).filter((i) => !isMajor(i)), "x") +
    axisPath(interior(height).filter((i) => !isMajor(i)), "y");
  const majorPath =
    axisPath(interior(width).filter(isMajor), "x") + axisPath(interior(height).filter(isMajor), "y");

  return (
    <>
      <div className="absolute inset-0 overflow-hidden rounded-board bg-board ring-2 ring-board-edge">
        <svg
          aria-hidden
          width={pixelWidth}
          height={pixelHeight}
          className="absolute inset-0"
          fill="none"
          strokeWidth={1}
          shapeRendering="crispEdges"
        >
          <path d={minorPath} className="text-grid-line" stroke="currentColor" />
          <path d={majorPath} className="text-grid-line-major" stroke="currentColor" />
        </svg>
      </div>
      <div aria-hidden className="pointer-events-none text-[11px] font-semibold text-ink-soft tabular-nums select-none">
        {range(width)
          .filter(showLabel)
          .map((x) => (
            <span
              key={`x${x}`}
              className="absolute flex items-end justify-center pb-1"
              style={{ left: x * cellSize, top: -rulerSize, width: cellSize, height: rulerSize }}
            >
              {x}
            </span>
          ))}
        {range(height)
          .filter(showLabel)
          .map((y) => (
            <span
              key={`y${y}`}
              className="absolute flex items-center justify-end pr-2"
              style={{ left: -rulerSize, top: y * cellSize, width: rulerSize, height: cellSize }}
            >
              {y}
            </span>
          ))}
      </div>
    </>
  );
}
