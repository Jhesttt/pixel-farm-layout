import { MIN_STACK_FOR_COUNT } from "./effectStyle";
import { getCellBounds, getEffectCells, getEffectCoverage } from "./grid";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

/** The effect of an object mid-drag, shown where it would land. */
export interface EffectPreview {
  defId: string;
  x: number;
  y: number;
  rotation: PlacedObject["rotation"];
}

export interface EffectArea {
  /** The object's id, or "preview". */
  key: string;
  def: ObjectDefinition;
  /** The area in cells, already clipped to the grid. */
  bounds: { x: number; y: number; width: number; height: number };
  preview: boolean;
}

export interface EffectOverlay {
  areas: EffectArea[];
  /** Cells covered by `MIN_STACK_FOR_COUNT` or more areas, with how many. */
  stacked: { x: number; y: number; n: number }[];
}

/**
 * Everything an effect overlay needs, independent of how the board is drawn (top or isometric):
 * one clipped rectangle per visible effect, plus the heavily stacked cells. `hiddenObjectId` is an
 * object being dragged, whose own effect is replaced by `preview`.
 */
export function computeEffectAreas(
  layout: FarmLayout,
  definitions: ObjectDefinition[],
  hiddenObjectId: string | null,
  preview: EffectPreview | null,
): EffectOverlay {
  const defsById = new Map(definitions.map((d) => [d.id, d]));
  const visible = layout.objects.filter((o) => o.id !== hiddenObjectId);
  const areas: EffectArea[] = [];

  for (const obj of visible) {
    const def = defsById.get(obj.defId);
    if (!def?.effect || !obj.showEffect) continue;
    const bounds = getCellBounds(getEffectCells(obj, def, layout));
    if (bounds) areas.push({ key: obj.id, def, bounds, preview: false });
  }

  const previewDef = preview ? defsById.get(preview.defId) : undefined;
  if (preview && previewDef?.effect) {
    const probe: PlacedObject = { id: "preview", ...preview, showEffect: true };
    const bounds = getCellBounds(getEffectCells(probe, previewDef, layout));
    if (bounds) areas.push({ key: "preview", def: previewDef, bounds, preview: true });
  }

  const coverage = getEffectCoverage({ ...layout, objects: visible }, definitions);
  const stacked = [...coverage.entries()]
    .filter(([, n]) => n >= MIN_STACK_FOR_COUNT)
    .map(([cell, n]) => {
      const [x, y] = cell.split(",").map(Number) as [number, number];
      return { x, y, n };
    });

  return { areas, stacked };
}
