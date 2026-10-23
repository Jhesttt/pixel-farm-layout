import { describe, expect, it } from "vitest";
import { computeEffectAreas } from "../lib/effects";
import type { FarmLayout, PlacedObject } from "../types";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";

const obj = (id: string, def: string, x: number, y: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({
  id, defId: `builtin-${def}`, x, y, rotation: 0, showEffect: true, ...extra,
});
const layoutOf = (objects: PlacedObject[], size = 15): FarmLayout => ({
  id: "l", name: "t", width: size, height: size, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

describe("computeEffectAreas", () => {
  it("returns one clipped rectangle per object that has an effect", () => {
    const { areas } = computeEffectAreas(layoutOf([obj("s", "scarecrow", 7, 7), obj("c", "crop", 1, 1)]), defs, null, null);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ key: "s", preview: false, bounds: { x: 4, y: 4, width: 7, height: 7 } });
  });

  it("clips an area at the grid edge", () => {
    const { areas } = computeEffectAreas(layoutOf([obj("s", "scarecrow", 0, 0)]), defs, null, null);
    expect(areas[0]?.bounds).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it("skips objects whose effect is switched off, and the object being dragged", () => {
    const layout = layoutOf([obj("off", "scarecrow", 3, 3, { showEffect: false }), obj("drag", "scarecrow", 9, 9)]);
    expect(computeEffectAreas(layout, defs, null, null).areas.map((a) => a.key)).toEqual(["drag"]);
    expect(computeEffectAreas(layout, defs, "drag", null).areas).toEqual([]);
  });

  it("adds the preview of a dragged definition at its drop position", () => {
    const { areas } = computeEffectAreas(layoutOf([]), defs, null, { defId: "builtin-sprinkler", x: 5, y: 5, rotation: 0 });
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ key: "preview", preview: true, bounds: { x: 4, y: 4, width: 3, height: 3 } });
  });

  it("ignores a preview for a definition without an effect", () => {
    expect(computeEffectAreas(layoutOf([]), defs, null, { defId: "builtin-crop", x: 5, y: 5, rotation: 0 }).areas).toEqual([]);
  });

  it("lists cells covered by three or more areas, but not two", () => {
    const two = computeEffectAreas(layoutOf([obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5)]), defs, null, null);
    expect(two.stacked).toEqual([]);
    const three = computeEffectAreas(layoutOf([obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5), obj("c", "sprinkler", 7, 5)]), defs, null, null);
    expect(three.stacked.length).toBeGreaterThan(0);
    expect(three.stacked.every((c) => c.n >= 3)).toBe(true);
    expect(three.stacked).toContainEqual({ x: 6, y: 5, n: 3 });
  });

  it("does not count a dragged object's effect toward stacking", () => {
    const layout = layoutOf([obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5), obj("c", "sprinkler", 7, 5)]);
    expect(computeEffectAreas(layout, defs, "c", null).stacked).toEqual([]);
  });
});
