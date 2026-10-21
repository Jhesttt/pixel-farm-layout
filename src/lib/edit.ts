import { canPlace, cellKey, getFootprint, getFootprintSize, isInBounds } from "./grid";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

const DUPLICATE_SEARCH_RADIUS = 12;

function nextRotation(rotation: PlacedObject["rotation"]): PlacedObject["rotation"] {
  return ((rotation + 90) % 360) as PlacedObject["rotation"];
}

function replaceObject(layout: FarmLayout, updated: PlacedObject): FarmLayout {
  return { ...layout, objects: layout.objects.map((o) => (o.id === updated.id ? updated : o)) };
}

/**
 * `obj` turned 90 degrees clockwise about its top-left cell. When that would leave the grid or hit
 * another object it is shifted back inside the grid first; null if it still does not fit.
 */
export function rotatedObject(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  obj: PlacedObject,
): PlacedObject | null {
  const def = defs.find((d) => d.id === obj.defId);
  if (!def) return null;
  const turned: PlacedObject = { ...obj, rotation: nextRotation(obj.rotation) };
  if (canPlace(layout, defs, turned, [obj.id])) return turned;

  const size = getFootprintSize(turned, def);
  const shifted: PlacedObject = {
    ...turned,
    x: Math.max(0, Math.min(turned.x, layout.width - size.width)),
    y: Math.max(0, Math.min(turned.y, layout.height - size.height)),
  };
  return canPlace(layout, defs, shifted, [obj.id]) ? shifted : null;
}

/**
 * Rotates each listed object in turn, so later ones see the earlier ones' new positions.
 * Objects that cannot turn stay as they are. Returns the updated objects (changed ones only).
 */
export function rotateObjects(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  ids: string[],
): PlacedObject[] {
  let working = layout;
  const changed: PlacedObject[] = [];
  for (const id of ids) {
    const obj = working.objects.find((o) => o.id === id);
    if (!obj) continue;
    const turned = rotatedObject(working, defs, obj);
    if (!turned) continue;
    working = replaceObject(working, turned);
    changed.push(turned);
  }
  return changed;
}

/**
 * The listed objects shifted by (dx, dy), or null if any would leave the grid or overlap an object
 * outside the group. The group keeps its shape, so members never collide with each other.
 */
export function nudgedObjects(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  ids: string[],
  dx: number,
  dy: number,
): PlacedObject[] | null {
  const selected = layout.objects.filter((o) => ids.includes(o.id));
  if (selected.length === 0) return null;
  const moved = selected.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
  return moved.every((o) => canPlace(layout, defs, o, ids)) ? moved : null;
}

/**
 * Copies of the listed objects shifted to the nearest free spot (searching outward from one cell
 * down-right, diagonal first), keeping their shape as a group. Returns copies with ids from `newId`, or null if
 * there is no room within the search radius.
 */
export function duplicatedObjects(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  ids: string[],
  newId: () => string,
): PlacedObject[] | null {
  const selected = layout.objects.filter((o) => ids.includes(o.id));
  if (selected.length === 0) return null;

  for (let radius = 1; radius <= DUPLICATE_SEARCH_RADIUS; radius++) {
    // The diagonal first, then the rest of this ring (right and down only).
    const ring: [number, number][] = [[radius, radius]];
    for (let dy = 0; dy <= radius; dy++) {
      for (let dx = 0; dx <= radius; dx++) {
        if (Math.max(dx, dy) === radius && !(dx === radius && dy === radius)) ring.push([dx, dy]);
      }
    }
    for (const [dx, dy] of ring) {
      const copies = selected.map((o) => ({ ...o, id: "", x: o.x + dx, y: o.y + dy }));
      if (copies.every((c) => canPlace(layout, defs, c))) {
        return copies.map((c) => ({ ...c, id: newId() }));
      }
    }
  }
  return null;
}

/**
 * Objects that do not fit `layout` under `defs`: out of bounds, or overlapping an earlier object
 * that does fit. Used after a definition's footprint changes, to find what must be removed.
 * Objects with an unknown definition are not reported.
 */
export function findMisfits(layout: FarmLayout, defs: ObjectDefinition[]): string[] {
  const defsById = new Map(defs.map((d) => [d.id, d]));
  const occupied = new Set<string>();
  const misfits: string[] = [];
  for (const obj of layout.objects) {
    const def = defsById.get(obj.defId);
    if (!def) continue;
    const cells = getFootprint(obj, def);
    const fits = isInBounds(cells, layout) && cells.every((c) => !occupied.has(cellKey(c.x, c.y)));
    if (!fits) {
      misfits.push(obj.id);
      continue;
    }
    for (const c of cells) occupied.add(cellKey(c.x, c.y));
  }
  return misfits;
}

/** How many objects across all layouts use the definition, and in how many layouts. */
export function countDefinitionUse(
  layouts: Record<string, FarmLayout>,
  defId: string,
): { objects: number; layouts: number } {
  let objects = 0;
  let inLayouts = 0;
  for (const layout of Object.values(layouts)) {
    const n = layout.objects.filter((o) => o.defId === defId).length;
    objects += n;
    if (n > 0) inLayouts++;
  }
  return { objects, layouts: inLayouts };
}
