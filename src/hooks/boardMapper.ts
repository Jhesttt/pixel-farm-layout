import { classifyPointer, pointerToCell } from "../lib/grid";
import type { Cell } from "../types";

/** Dragging a placed object this far (or more) off the board deletes it; closer just cancels. */
export const DELETE_MARGIN_PX = 16;

export interface BoardLocation {
  /** The cell under the pointer. May lie outside the grid. */
  cell: Cell;
  /** "over" the board, "near" it (forgiven overshoot), or "away" from it. */
  zone: "over" | "near" | "away";
}

/**
 * How a board turns pointer positions into grid cells. Drag and drop is written against this, so it
 * works the same for the straight-down board and the isometric one.
 */
export interface BoardMapper {
  /** Approximate size of a cell on screen, in px, for sizing a ghost that floats free of the board. */
  cellSize: number;
  locate(clientX: number, clientY: number): BoardLocation;
  /**
   * The viewport rectangle of a footprint with its top-left at cell (x, y), for boards that are
   * axis-aligned. Boards that draw their own ghost (isometric) leave this out.
   */
  snapRect?(
    x: number,
    y: number,
    width: number,
    height: number,
  ): { left: number; top: number; width: number; height: number };
}

/**
 * The straight-down board: `grid` is the element whose top-left is cell (0, 0) and whose width spans
 * `columns` cells. The board is the part of it that is actually visible inside its scroller.
 */
export function createTopMapper(grid: HTMLElement, columns: number): BoardMapper {
  const rect = () => grid.getBoundingClientRect();
  const cellSize = rect().width / columns;
  return {
    cellSize,
    locate(clientX, clientY) {
      const r = rect();
      const scroller = grid.closest("[data-board-scroller]")?.getBoundingClientRect() ?? null;
      return {
        cell: pointerToCell(clientX, clientY, r, cellSize),
        zone: classifyPointer({ x: clientX, y: clientY }, r, scroller, DELETE_MARGIN_PX),
      };
    },
    snapRect(x, y, width, height) {
      const r = rect();
      return { left: r.left + x * cellSize, top: r.top + y * cellSize, width: width * cellSize, height: height * cellSize };
    },
  };
}
