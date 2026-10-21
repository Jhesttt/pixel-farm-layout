import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS } from "../data/builtIns";
import { sampleObjectsFor } from "../data/sampleObjects";
import { getOccupiedMap, getFootprint } from "../lib/grid";
import type { FarmLayout } from "../types";

const layout = (width: number, height: number): FarmLayout => ({
  id: "l", name: "t", width, height, objects: [], createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

describe("sampleObjectsFor", () => {
  it("places every sample on a 17x17 grid without overlap", () => {
    const objects = sampleObjectsFor(layout(17, 17), BUILT_IN_DEFINITIONS);
    expect(objects).toHaveLength(18);
    const cells = objects.flatMap((o) => getFootprint(o, BUILT_IN_DEFINITIONS.find((d) => d.id === o.defId)!));
    expect(getOccupiedMap({ ...layout(17, 17), objects }, BUILT_IN_DEFINITIONS).size).toBe(cells.length);
  });

  it("covers every built-in and all four rotations", () => {
    const objects = sampleObjectsFor(layout(17, 17), BUILT_IN_DEFINITIONS);
    expect(new Set(objects.map((o) => o.defId))).toEqual(new Set(BUILT_IN_DEFINITIONS.map((d) => d.id)));
    expect(new Set(objects.map((o) => o.rotation))).toEqual(new Set([0, 90, 180, 270]));
  });

  it("drops samples that do not fit a small grid instead of overflowing", () => {
    const small = layout(6, 6);
    const objects = sampleObjectsFor(small, BUILT_IN_DEFINITIONS);
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.length).toBeLessThan(18);
    for (const o of objects) {
      const def = BUILT_IN_DEFINITIONS.find((d) => d.id === o.defId)!;
      for (const c of getFootprint(o, def)) {
        expect(c.x).toBeLessThan(6);
        expect(c.y).toBeLessThan(6);
      }
    }
  });
});
