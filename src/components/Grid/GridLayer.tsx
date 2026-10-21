interface GridLayerProps {
  width: number;
  height: number;
  cellSize: number;
  /** Space reserved outside the grid on the top and left for the coordinate labels. */
  rulerSize: number;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Cell lines (one CSS gradient, not one div per cell) and coordinates on the top and left edges. */
export default function GridLayer({ width, height, cellSize, rulerSize }: GridLayerProps) {
  const line = "rgba(0, 0, 0, 0.18)";
  return (
    <>
      <div
        className="absolute inset-0 border border-stone-400 bg-emerald-50"
        style={{
          boxSizing: "content-box",
          backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
          backgroundSize: `${cellSize}px ${cellSize}px`,
        }}
      />
      <div aria-hidden className="pointer-events-none select-none text-[10px] text-stone-500">
        {range(width).map((x) => (
          <span
            key={`x${x}`}
            className="absolute flex items-end justify-center"
            style={{ left: x * cellSize, top: -rulerSize, width: cellSize, height: rulerSize }}
          >
            {x}
          </span>
        ))}
        {range(height).map((y) => (
          <span
            key={`y${y}`}
            className="absolute flex items-center justify-end pr-1"
            style={{ left: -rulerSize, top: y * cellSize, width: rulerSize, height: cellSize }}
          >
            {y}
          </span>
        ))}
      </div>
    </>
  );
}
