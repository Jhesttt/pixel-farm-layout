import { useEffect, useState, type RefObject } from "react";

export const MIN_CELL_SIZE = 16;
export const MAX_CELL_SIZE = 48;

/**
 * Pixel size of one grid cell: as large as fits `columns` cells in the container's width,
 * clamped to MIN_CELL_SIZE..MAX_CELL_SIZE. `reservedWidth` is subtracted first (rulers, padding).
 *
 * The container may mount after this hook first runs (the board only exists once a layout does),
 * so the element is re-read after every render and observed as soon as it appears.
 */
export function useCellSize(
  containerRef: RefObject<HTMLElement | null>,
  columns: number,
  reservedWidth: number,
): number {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Cheap: only sets state when the element actually changed (mounted, unmounted or replaced).
  useEffect(() => {
    if (containerRef.current !== element) setElement(containerRef.current);
  });

  useEffect(() => {
    if (!element) {
      setContainerWidth(0);
      return;
    }
    setContainerWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  if (containerWidth === 0) return MAX_CELL_SIZE;
  const fit = Math.floor((containerWidth - reservedWidth) / columns);
  return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, fit));
}
