import type { RefObject } from "react";
import { useElementWidth } from "./useElementWidth";

export const MIN_CELL_SIZE = 16;
export const MAX_CELL_SIZE = 48;

/**
 * Pixel size of one grid cell: as large as fits `columns` cells in the container's width,
 * clamped to MIN_CELL_SIZE..MAX_CELL_SIZE. `reservedWidth` is subtracted first (rulers, padding).
 */
export function useCellSize(
  containerRef: RefObject<HTMLElement | null>,
  columns: number,
  reservedWidth: number,
): number {
  const containerWidth = useElementWidth(containerRef);
  if (containerWidth === 0) return MAX_CELL_SIZE;
  const fit = Math.floor((containerWidth - reservedWidth) / columns);
  return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, fit));
}
