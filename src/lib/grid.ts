import type { Cell, FarmLayout, ObjectDefinition, PlacedObject } from "../types.ts";

export const GRID_MIN_SIZE = 4;
export const GRID_MAX_SIZE = 64;

/** Rounds to an integer within GRID_MIN_SIZE..GRID_MAX_SIZE; non-finite input becomes the minimum. */
export function clampGridSize(n: number): number {
  if (!Number.isFinite(n)) return GRID_MIN_SIZE;
  return Math.min(GRID_MAX_SIZE, Math.max(GRID_MIN_SIZE, Math.round(n)));
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function indexDefinitions(defs: ObjectDefinition[]): Map<string, ObjectDefinition> {
  return new Map(defs.map((def) => [def.id, def]));
}

function rectCells(x0: number, y0: number, width: number, height: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}

function isInLayout(cell: Cell, layout: FarmLayout): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < layout.width && cell.y < layout.height;
}

/** Footprint width and height in cells, with width and height swapped at 90 and 270 degrees. */
export function getFootprintSize(
  obj: PlacedObject,
  def: ObjectDefinition,
): { width: number; height: number } {
  const swapped = obj.rotation % 180 !== 0;
  return swapped ? { width: def.height, height: def.width } : { width: def.width, height: def.height };
}

/** The grid cell under a pointer, given the grid's top-left corner and the cell size, all in px. */
export function pointerToCell(
  pointerX: number,
  pointerY: number,
  origin: { left: number; top: number },
  cellSize: number,
): Cell {
  return {
    x: Math.floor((pointerX - origin.left) / cellSize),
    y: Math.floor((pointerY - origin.top) / cellSize),
  };
}

/** Keeps a grab offset (which cell of the object is held) inside a footprint of this size. */
export function clampGrab(
  grab: { dx: number; dy: number },
  size: { width: number; height: number },
): { dx: number; dy: number } {
  return {
    dx: Math.min(Math.max(grab.dx, 0), size.width - 1),
    dy: Math.min(Math.max(grab.dy, 0), size.height - 1),
  };
}

/** Cells covered by the object's footprint, in absolute grid coordinates. */
export function getFootprint(obj: PlacedObject, def: ObjectDefinition): Cell[] {
  const { width, height } = getFootprintSize(obj, def);
  return rectCells(obj.x, obj.y, width, height);
}

/**
 * Cells covered by the object's area of effect, in absolute grid coordinates, clipped to the
 * layout bounds. Pure geometry: ignores `obj.showEffect`. Empty if the definition has no effect.
 *
 * Rotation is clockwise. The effect rect is defined relative to the unrotated footprint's
 * top-left; rotating turns the effect rect about the footprint so it stays attached to the
 * same side of the object (a "waters downward" sprinkler rotated 90 waters leftward).
 */
export function getEffectCells(
  obj: PlacedObject,
  def: ObjectDefinition,
  layout: FarmLayout,
): Cell[] {
  const effect = def.effect;
  if (!effect) return [];

  // Effect rect in unrotated local coordinates, half-open: [x0, x1) x [y0, y1)
  const x0 = effect.offsetX;
  const y0 = effect.offsetY;
  const x1 = x0 + effect.width;
  const y1 = y0 + effect.height;
  const { width: w, height: h } = def;

  let rect: { x0: number; y0: number; x1: number; y1: number };
  switch (obj.rotation) {
    case 0:
      rect = { x0, y0, x1, y1 };
      break;
    case 90:
      rect = { x0: h - y1, y0: x0, x1: h - y0, y1: x1 };
      break;
    case 180:
      rect = { x0: w - x1, y0: h - y1, x1: w - x0, y1: h - y0 };
      break;
    case 270:
      rect = { x0: y0, y0: w - x1, x1: y1, y1: w - x0 };
      break;
  }

  return rectCells(obj.x + rect.x0, obj.y + rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0).filter(
    (cell) => isInLayout(cell, layout),
  );
}

/** True if every cell lies inside the layout. Vacuously true for no cells. */
export function isInBounds(cells: Cell[], layout: FarmLayout): boolean {
  return cells.every((cell) => isInLayout(cell, layout));
}

function buildOccupiedMap(
  layout: FarmLayout,
  defsById: Map<string, ObjectDefinition>,
  ignore?: ReadonlySet<string>,
): Map<string, string> {
  const occupied = new Map<string, string>();
  for (const obj of layout.objects) {
    if (ignore?.has(obj.id)) continue;
    const def = defsById.get(obj.defId);
    if (!def) continue;
    for (const cell of getFootprint(obj, def)) {
      occupied.set(cellKey(cell.x, cell.y), obj.id);
    }
  }
  return occupied;
}

/** "x,y" -> id of the placed object whose footprint covers that cell. */
export function getOccupiedMap(layout: FarmLayout, defs: ObjectDefinition[]): Map<string, string> {
  return buildOccupiedMap(layout, indexDefinitions(defs));
}

/**
 * Whether `candidate` fits: its definition exists, its footprint is inside the grid, and it does
 * not overlap any other object's footprint. Objects in `ignoreIds` are treated as absent (pass the
 * candidate's own id when moving an existing object). Effects never block placement.
 */
export function canPlace(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  candidate: PlacedObject,
  ignoreIds: string[] = [],
): boolean {
  const defsById = indexDefinitions(defs);
  const def = defsById.get(candidate.defId);
  if (!def) return false;

  const footprint = getFootprint(candidate, def);
  if (!isInBounds(footprint, layout)) return false;

  const occupied = buildOccupiedMap(layout, defsById, new Set(ignoreIds));
  return footprint.every((cell) => !occupied.has(cellKey(cell.x, cell.y)));
}

/**
 * Placed objects whose footprint would not fit a `width` x `height` grid, i.e. what resizing the
 * layout to that size would drop. Objects with an unknown definition are not reported.
 */
export function getObjectsOutsideSize(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  width: number,
  height: number,
): PlacedObject[] {
  const defsById = indexDefinitions(defs);
  const resized = { ...layout, width, height };
  return layout.objects.filter((obj) => {
    const def = defsById.get(obj.defId);
    return def !== undefined && !isInBounds(getFootprint(obj, def), resized);
  });
}

/**
 * "x,y" -> number of effects covering that cell, for heat shading. Only objects with
 * `showEffect` set contribute, so hiding an object's effect also removes its shading.
 */
export function getEffectCoverage(layout: FarmLayout, defs: ObjectDefinition[]): Map<string, number> {
  const defsById = indexDefinitions(defs);
  const coverage = new Map<string, number>();
  for (const obj of layout.objects) {
    if (!obj.showEffect) continue;
    const def = defsById.get(obj.defId);
    if (!def) continue;
    for (const cell of getEffectCells(obj, def, layout)) {
      const key = cellKey(cell.x, cell.y);
      coverage.set(key, (coverage.get(key) ?? 0) + 1);
    }
  }
  return coverage;
}

/** Smallest rectangle containing the cells, or null for none. Exact for a clipped rect effect. */
export function getCellBounds(cells: Cell[]): { x: number; y: number; width: number; height: number } | null {
  if (cells.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Offset that centres an effect of `effectSize` on an object of `objectSize` along one axis. */
export function centeredOffset(objectSize: number, effectSize: number): number {
  return 0 - Math.floor((effectSize - objectSize) / 2); // 0 - n, not -n: avoids negative zero
}
