import { canPlace } from "../lib/grid.ts";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types.ts";

type Sample = Omit<PlacedObject, "id" | "showEffect"> & { showEffect?: boolean };

// Step 4 only: a hardcoded spread that exercises every built-in, rotation and the label and
// colour-override paths. Step 5 replaces this with objects placed by dragging.
const SAMPLES: Sample[] = [
  { defId: "builtin-barn", x: 1, y: 1, rotation: 0, label: "Main" },
  { defId: "builtin-barn", x: 12, y: 12, rotation: 0, label: "Storage", colorOverride: "#c9b398" },
  { defId: "builtin-tree", x: 6, y: 1, rotation: 0 },
  { defId: "builtin-tree", x: 9, y: 1, rotation: 90 },
  { defId: "builtin-fence", x: 6, y: 5, rotation: 0 },
  { defId: "builtin-fence", x: 9, y: 5, rotation: 90 },
  { defId: "builtin-fence", x: 11, y: 5, rotation: 180 },
  { defId: "builtin-fence", x: 14, y: 5, rotation: 270 },
  { defId: "builtin-scarecrow", x: 13, y: 2, rotation: 0, label: "Scare" },
  { defId: "builtin-sprinkler", x: 4, y: 7, rotation: 0 },
  { defId: "builtin-crop", x: 1, y: 7, rotation: 0 },
  { defId: "builtin-crop", x: 2, y: 7, rotation: 0 },
  { defId: "builtin-crop", x: 1, y: 8, rotation: 0, label: "A" },
  { defId: "builtin-path", x: 1, y: 10, rotation: 0 },
  { defId: "builtin-path", x: 2, y: 10, rotation: 0 },
  { defId: "builtin-path", x: 3, y: 10, rotation: 0 },
  { defId: "builtin-water", x: 6, y: 9, rotation: 0 },
  { defId: "builtin-water", x: 7, y: 9, rotation: 0 },
];

/** The samples that fit in `layout`, placed one by one with the same rules the editor will use. */
export function sampleObjectsFor(layout: FarmLayout, defs: ObjectDefinition[]): PlacedObject[] {
  const placed: PlacedObject[] = [];
  for (const [i, sample] of SAMPLES.entries()) {
    const candidate: PlacedObject = { ...sample, id: `sample-${i}`, showEffect: sample.showEffect ?? true };
    if (canPlace({ ...layout, objects: placed }, defs, candidate)) placed.push(candidate);
  }
  return placed;
}
