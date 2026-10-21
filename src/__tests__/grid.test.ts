import { describe, expect, it } from "vitest";
import { FIXTURE_DEFINITIONS } from "./fixtures";
import {
  canPlace,
  classifyPointer,
  clampGrab,
  clampGridSize,
  cellKey,
  getCellBounds,
  getEffectCells,
  getEffectCoverage,
  getFootprint,
  getFootprintSize,
  getObjectsOutsideSize,
  getOccupiedMap,
  isInBounds,
  pointerToCell,
} from "../lib/grid";
import type { Cell, FarmLayout, ObjectDefinition, PlacedObject } from "../types";

function def(id: string): ObjectDefinition {
  const found = FIXTURE_DEFINITIONS.find((d) => d.id === `builtin-${id}`);
  if (!found) throw new Error(`no built-in ${id}`);
  return found;
}

const crop = def("crop");
const tree = def("tree");
const barn = def("barn");
const scarecrow = def("scarecrow");
const sprinkler = def("sprinkler");
const fence = def("fence");

// 1x1 sprinkler that only waters the 3 cells below it
const downSprinkler: ObjectDefinition = {
  id: "down-sprinkler",
  name: "Down Sprinkler",
  width: 1,
  height: 1,
  color: "#0284c7",
  builtIn: false,
  effect: { width: 1, height: 3, offsetX: 0, offsetY: 1, color: "#38bdf8", shape: "rect" },
};

// 2x1 with a single effect cell just past its right end
const rightPointer: ObjectDefinition = {
  id: "right-pointer",
  name: "Right Pointer",
  width: 2,
  height: 1,
  color: "#000000",
  builtIn: false,
  effect: { width: 1, height: 1, offsetX: 2, offsetY: 0, color: "#ff0000", shape: "rect" },
};

// 2x1 with a 4x3 effect centered on it: offsetX = -floor((4-2)/2), offsetY = -floor((3-1)/2)
const wideCentered: ObjectDefinition = {
  id: "wide-centered",
  name: "Wide Centered",
  width: 2,
  height: 1,
  color: "#000000",
  builtIn: false,
  effect: { width: 4, height: 3, offsetX: -1, offsetY: -1, color: "#ff0000", shape: "rect" },
};

const defs: ObjectDefinition[] = [
  ...FIXTURE_DEFINITIONS,
  downSprinkler,
  rightPointer,
  wideCentered,
];

function placed(
  id: string,
  d: ObjectDefinition,
  x: number,
  y: number,
  rotation: PlacedObject["rotation"] = 0,
  showEffect = true,
): PlacedObject {
  return { id, defId: d.id, x, y, rotation, showEffect };
}

function makeLayout(width: number, height: number, objects: PlacedObject[] = []): FarmLayout {
  return { id: "layout", name: "Test", width, height, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1 };
}

function keys(cells: Cell[]): string[] {
  return cells.map((c) => cellKey(c.x, c.y)).sort();
}

function bounds(cells: Cell[]) {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("getFootprint", () => {
  it("returns a single cell for a 1x1 object", () => {
    expect(getFootprint(placed("a", crop, 3, 4), crop)).toEqual([{ x: 3, y: 4 }]);
  });

  it("covers width x height cells starting at the top-left", () => {
    const cells = getFootprint(placed("a", barn, 2, 5), barn);
    expect(cells).toHaveLength(16);
    expect(bounds(cells)).toEqual({ minX: 2, maxX: 5, minY: 5, maxY: 8 });
    expect(new Set(keys(cells)).size).toBe(16);
  });

  it("handles non-square footprints at rotation 0", () => {
    expect(keys(getFootprint(placed("a", fence, 1, 1), fence))).toEqual(["1,1", "2,1"]);
  });

  it("swaps width and height at 90 degrees", () => {
    expect(keys(getFootprint(placed("a", fence, 1, 1, 90), fence))).toEqual(["1,1", "1,2"]);
  });

  it("keeps width and height at 180 degrees", () => {
    expect(keys(getFootprint(placed("a", fence, 1, 1, 180), fence))).toEqual(["1,1", "2,1"]);
  });

  it("swaps width and height at 270 degrees", () => {
    expect(keys(getFootprint(placed("a", fence, 1, 1, 270), fence))).toEqual(["1,1", "1,2"]);
  });

  it("is unchanged by rotation for square objects", () => {
    const base = keys(getFootprint(placed("a", tree, 4, 4), tree));
    for (const rotation of [90, 180, 270] as const) {
      expect(keys(getFootprint(placed("a", tree, 4, 4, rotation), tree))).toEqual(base);
    }
  });

  it("does not clip to any layout bounds", () => {
    expect(keys(getFootprint(placed("a", fence, -1, -1), fence))).toEqual(["-1,-1", "0,-1"]);
  });
});

describe("isInBounds", () => {
  const layout = makeLayout(5, 4);

  it("accepts cells on every edge", () => {
    expect(isInBounds([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }], layout)).toBe(true);
  });

  it("rejects cells past each edge", () => {
    expect(isInBounds([{ x: -1, y: 0 }], layout)).toBe(false);
    expect(isInBounds([{ x: 0, y: -1 }], layout)).toBe(false);
    expect(isInBounds([{ x: 5, y: 0 }], layout)).toBe(false);
    expect(isInBounds([{ x: 0, y: 4 }], layout)).toBe(false);
  });

  it("rejects when any single cell is outside", () => {
    expect(isInBounds([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 9, y: 9 }], layout)).toBe(false);
  });

  it("is true for an empty cell list", () => {
    expect(isInBounds([], layout)).toBe(true);
  });
});

describe("getOccupiedMap", () => {
  it("is empty for an empty layout", () => {
    expect(getOccupiedMap(makeLayout(8, 8), defs).size).toBe(0);
  });

  it("maps every footprint cell to its object id", () => {
    const layout = makeLayout(8, 8, [placed("t", tree, 0, 0), placed("f", fence, 3, 3, 90)]);
    const map = getOccupiedMap(layout, defs);
    expect(map.size).toBe(6);
    expect(map.get("0,0")).toBe("t");
    expect(map.get("1,1")).toBe("t");
    expect(map.get("3,3")).toBe("f");
    expect(map.get("3,4")).toBe("f");
    expect(map.has("4,3")).toBe(false);
  });

  it("skips objects whose definition is missing", () => {
    const layout = makeLayout(8, 8, [{ ...placed("x", crop, 1, 1), defId: "gone" }]);
    expect(getOccupiedMap(layout, defs).size).toBe(0);
  });
});

describe("canPlace", () => {
  it("allows placement on an empty grid", () => {
    expect(canPlace(makeLayout(8, 8), defs, placed("n", barn, 0, 0))).toBe(true);
  });

  it("allows an object flush against the bottom-right corner", () => {
    expect(canPlace(makeLayout(8, 8), defs, placed("n", barn, 4, 4))).toBe(true);
  });

  it("rejects objects that extend past any edge", () => {
    const layout = makeLayout(8, 8);
    expect(canPlace(layout, defs, placed("n", barn, 5, 0))).toBe(false); // right
    expect(canPlace(layout, defs, placed("n", barn, 0, 5))).toBe(false); // bottom
    expect(canPlace(layout, defs, placed("n", crop, -1, 0))).toBe(false); // left
    expect(canPlace(layout, defs, placed("n", crop, 0, -1))).toBe(false); // top
    expect(canPlace(layout, defs, placed("n", crop, 8, 0))).toBe(false);
  });

  it("uses the rotated footprint for the bounds check", () => {
    const layout = makeLayout(4, 4);
    // 2x1 fits at the bottom edge flat, but 1x2 sticks out below
    expect(canPlace(layout, defs, placed("n", fence, 0, 3, 0))).toBe(true);
    expect(canPlace(layout, defs, placed("n", fence, 0, 3, 90))).toBe(false);
    // and the reverse on the right edge
    expect(canPlace(layout, defs, placed("n", fence, 3, 0, 0))).toBe(false);
    expect(canPlace(layout, defs, placed("n", fence, 3, 0, 90))).toBe(true);
  });

  it("rejects overlap with an existing footprint", () => {
    const layout = makeLayout(8, 8, [placed("t", tree, 2, 2)]);
    expect(canPlace(layout, defs, placed("n", crop, 3, 3))).toBe(false);
    expect(canPlace(layout, defs, placed("n", tree, 3, 3))).toBe(false);
    expect(canPlace(layout, defs, placed("n", barn, 0, 0))).toBe(false);
  });

  it("allows objects that touch but do not overlap", () => {
    const layout = makeLayout(8, 8, [placed("t", tree, 2, 2)]);
    expect(canPlace(layout, defs, placed("n", crop, 4, 2))).toBe(true);
    expect(canPlace(layout, defs, placed("n", crop, 2, 4))).toBe(true);
    expect(canPlace(layout, defs, placed("n", crop, 1, 1))).toBe(true);
  });

  it("detects overlap against rotated existing objects", () => {
    const layout = makeLayout(8, 8, [placed("f", fence, 2, 2, 90)]); // occupies (2,2),(2,3)
    expect(canPlace(layout, defs, placed("n", crop, 2, 3))).toBe(false);
    expect(canPlace(layout, defs, placed("n", crop, 3, 2))).toBe(true);
  });

  it("rejects a candidate that collides with itself unless its id is ignored", () => {
    const layout = makeLayout(8, 8, [placed("t", tree, 2, 2)]);
    const moved = placed("t", tree, 3, 2); // overlaps its own old position
    expect(canPlace(layout, defs, moved)).toBe(false);
    expect(canPlace(layout, defs, moved, ["t"])).toBe(true);
  });

  it("ignoreIds only exempts the listed objects", () => {
    const layout = makeLayout(8, 8, [placed("a", crop, 1, 1), placed("b", crop, 2, 1)]);
    const candidate = placed("n", fence, 1, 1); // covers (1,1) and (2,1)
    expect(canPlace(layout, defs, candidate, ["a"])).toBe(false);
    expect(canPlace(layout, defs, candidate, ["b"])).toBe(false);
    expect(canPlace(layout, defs, candidate, ["a", "b"])).toBe(true);
  });

  it("ignoreIds does not bypass the bounds check", () => {
    const layout = makeLayout(4, 4, [placed("t", tree, 0, 0)]);
    expect(canPlace(layout, defs, placed("t", tree, 3, 3), ["t"])).toBe(false);
  });

  it("ignores ids that are not in the layout", () => {
    expect(canPlace(makeLayout(8, 8), defs, placed("n", crop, 0, 0), ["nope"])).toBe(true);
  });

  it("rejects a candidate whose definition is unknown", () => {
    expect(canPlace(makeLayout(8, 8), defs, { ...placed("n", crop, 0, 0), defId: "gone" })).toBe(false);
  });

  it("does not treat effect areas as collisions", () => {
    const layout = makeLayout(10, 10, [placed("s", scarecrow, 5, 5)]);
    // inside the scarecrow's 7x7 range
    expect(canPlace(layout, defs, placed("n", crop, 6, 6))).toBe(true);
    expect(canPlace(layout, defs, placed("n", tree, 3, 3))).toBe(true);
    // its own footprint is still solid
    expect(canPlace(layout, defs, placed("n", crop, 5, 5))).toBe(false);
  });
});

describe("getEffectCells", () => {
  const layout = makeLayout(15, 15);

  it("is empty for a definition without an effect", () => {
    expect(getEffectCells(placed("a", crop, 5, 5), crop, layout)).toEqual([]);
  });

  it("covers the full 7x7 centered on a scarecrow", () => {
    const cells = getEffectCells(placed("s", scarecrow, 7, 7), scarecrow, layout);
    expect(cells).toHaveLength(49);
    expect(bounds(cells)).toEqual({ minX: 4, maxX: 10, minY: 4, maxY: 10 });
    expect(keys(cells)).toContain("7,7"); // includes its own footprint cell
  });

  it("covers the 3x3 centered on a sprinkler", () => {
    const cells = getEffectCells(placed("s", sprinkler, 2, 2), sprinkler, layout);
    expect(cells).toHaveLength(9);
    expect(bounds(cells)).toEqual({ minX: 1, maxX: 3, minY: 1, maxY: 3 });
  });

  it("is not affected by rotation when centered on a square footprint", () => {
    const base = keys(getEffectCells(placed("s", scarecrow, 7, 7), scarecrow, layout));
    for (const rotation of [90, 180, 270] as const) {
      expect(keys(getEffectCells(placed("s", scarecrow, 7, 7, rotation), scarecrow, layout))).toEqual(base);
    }
  });

  describe("clipping to layout bounds", () => {
    it("clips at the top-left corner", () => {
      const cells = getEffectCells(placed("s", scarecrow, 0, 0), scarecrow, layout);
      expect(cells).toHaveLength(16); // 4x4 of the 7x7 survives
      expect(bounds(cells)).toEqual({ minX: 0, maxX: 3, minY: 0, maxY: 3 });
    });

    it("clips at the bottom-right corner", () => {
      const cells = getEffectCells(placed("s", scarecrow, 14, 14), scarecrow, layout);
      expect(cells).toHaveLength(16);
      expect(bounds(cells)).toEqual({ minX: 11, maxX: 14, minY: 11, maxY: 14 });
    });

    it("clips along a single edge", () => {
      const cells = getEffectCells(placed("s", scarecrow, 7, 0), scarecrow, layout);
      expect(cells).toHaveLength(28); // 7 wide x 4 tall
      expect(bounds(cells)).toEqual({ minX: 4, maxX: 10, minY: 0, maxY: 3 });
    });

    it("returns nothing when the whole effect is out of bounds", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 3, 14), downSprinkler, layout);
      expect(cells).toEqual([]);
    });

    it("never returns a cell outside the layout", () => {
      for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14], [7, 0], [0, 7]] as const) {
        const cells = getEffectCells(placed("s", scarecrow, x, y), scarecrow, layout);
        expect(isInBounds(cells, layout)).toBe(true);
      }
    });

    it("uses the layout size of the layout passed in", () => {
      const small = makeLayout(5, 5);
      const cells = getEffectCells(placed("s", scarecrow, 2, 2), scarecrow, small);
      expect(cells).toHaveLength(25);
    });
  });

  describe("directional effects follow rotation (clockwise)", () => {
    it("rotation 0: a downward sprinkler waters the 3 cells below", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 5, 5, 0), downSprinkler, layout);
      expect(keys(cells)).toEqual(["5,6", "5,7", "5,8"]);
    });

    it("rotation 90: downward becomes leftward", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 5, 5, 90), downSprinkler, layout);
      expect(keys(cells)).toEqual(["2,5", "3,5", "4,5"]);
    });

    it("rotation 180: downward becomes upward", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 5, 5, 180), downSprinkler, layout);
      expect(keys(cells)).toEqual(["5,2", "5,3", "5,4"]);
    });

    it("rotation 270: downward becomes rightward", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 5, 5, 270), downSprinkler, layout);
      expect(keys(cells)).toEqual(["6,5", "7,5", "8,5"]);
    });

    it("keeps an effect attached to the same end of a non-square footprint", () => {
      const at = (rotation: PlacedObject["rotation"]) =>
        keys(getEffectCells(placed("p", rightPointer, 3, 3, rotation), rightPointer, layout));
      expect(at(0)).toEqual(["5,3"]); // footprint (3,3)-(4,3); just right of it
      expect(at(90)).toEqual(["3,5"]); // footprint (3,3)-(3,4); just below it
      expect(at(180)).toEqual(["2,3"]); // footprint (3,3)-(4,3); just left of it
      expect(at(270)).toEqual(["3,2"]); // footprint (3,3)-(3,4); just above it
    });

    it("keeps a centered effect centered on a rotated non-square footprint", () => {
      const flat = getEffectCells(placed("w", wideCentered, 5, 5, 0), wideCentered, layout);
      expect(flat).toHaveLength(12);
      expect(bounds(flat)).toEqual({ minX: 4, maxX: 7, minY: 4, maxY: 6 });

      const upright = getEffectCells(placed("w", wideCentered, 5, 5, 90), wideCentered, layout);
      expect(upright).toHaveLength(12);
      // footprint is (5,5)-(5,6); effect is 3 wide x 4 tall around it
      expect(bounds(upright)).toEqual({ minX: 4, maxX: 6, minY: 4, maxY: 7 });
    });

    it("clips a rotated effect", () => {
      const cells = getEffectCells(placed("d", downSprinkler, 1, 5, 90), downSprinkler, layout);
      expect(keys(cells)).toEqual(["0,5"]); // x = -2, -1, 0 -> only 0 survives
    });
  });
});

describe("getEffectCoverage", () => {
  it("is empty for an empty layout", () => {
    expect(getEffectCoverage(makeLayout(10, 10), defs).size).toBe(0);
  });

  it("is empty when no object has an effect", () => {
    const layout = makeLayout(10, 10, [placed("c", crop, 1, 1), placed("t", tree, 4, 4)]);
    expect(getEffectCoverage(layout, defs).size).toBe(0);
  });

  it("counts 1 across a single effect's cells", () => {
    const layout = makeLayout(15, 15, [placed("s", scarecrow, 7, 7)]);
    const coverage = getEffectCoverage(layout, defs);
    expect(coverage.size).toBe(49);
    expect([...coverage.values()].every((n) => n === 1)).toBe(true);
  });

  it("stacks counts where effects overlap", () => {
    // sprinklers at (3,3) and (5,3): 3x3 areas share the column x=4, rows 2..4
    const layout = makeLayout(10, 10, [placed("a", sprinkler, 3, 3), placed("b", sprinkler, 5, 3)]);
    const coverage = getEffectCoverage(layout, defs);
    expect(coverage.size).toBe(15); // 9 + 9 - 3 shared
    for (const y of [2, 3, 4]) {
      expect(coverage.get(cellKey(4, y))).toBe(2);
      expect(coverage.get(cellKey(2, y))).toBe(1);
      expect(coverage.get(cellKey(6, y))).toBe(1);
    }
  });

  it("stacks beyond two", () => {
    const layout = makeLayout(10, 10, [
      placed("a", sprinkler, 4, 4),
      placed("b", sprinkler, 5, 4),
      placed("c", sprinkler, 4, 5),
      placed("d", scarecrow, 5, 5),
    ]);
    const coverage = getEffectCoverage(layout, defs);
    // (5,5) is inside all three sprinklers' 3x3 areas and the scarecrow's 7x7
    expect(coverage.get("5,5")).toBe(4);
  });

  it("stacks different object types", () => {
    const layout = makeLayout(10, 10, [placed("s", scarecrow, 5, 5), placed("w", sprinkler, 6, 5)]);
    const coverage = getEffectCoverage(layout, defs);
    expect(coverage.get("6,5")).toBe(2);
    expect(coverage.get("2,5")).toBe(1); // scarecrow only
    expect(coverage.get("7,5")).toBe(2);
    expect(coverage.get("8,5")).toBe(1);
  });

  it("counts a cell once per object even when it is inside its own footprint", () => {
    const layout = makeLayout(10, 10, [placed("s", sprinkler, 5, 5)]);
    expect(getEffectCoverage(layout, defs).get("5,5")).toBe(1);
  });

  it("clips coverage to the layout bounds", () => {
    const layout = makeLayout(6, 6, [placed("s", scarecrow, 0, 0)]);
    const coverage = getEffectCoverage(layout, defs);
    expect(coverage.size).toBe(16);
    expect(coverage.has("-1,0")).toBe(false);
    expect(coverage.has("4,0")).toBe(false);
  });

  it("excludes objects with showEffect turned off", () => {
    const layout = makeLayout(10, 10, [
      placed("a", sprinkler, 3, 3),
      placed("b", sprinkler, 4, 3, 0, false),
    ]);
    const coverage = getEffectCoverage(layout, defs);
    expect(coverage.size).toBe(9);
    expect(coverage.get("4,3")).toBe(1);
    expect(coverage.has("5,3")).toBe(false);
  });

  it("honors rotation of directional effects", () => {
    const layout = makeLayout(10, 10, [placed("a", downSprinkler, 5, 5, 0), placed("b", downSprinkler, 5, 9, 180)]);
    const coverage = getEffectCoverage(layout, defs);
    // a waters (5,6..8); b waters (5,6..8) upward from (5,9)
    expect(coverage.get("5,6")).toBe(2);
    expect(coverage.get("5,7")).toBe(2);
    expect(coverage.get("5,8")).toBe(2);
    expect(coverage.size).toBe(3);
  });

  it("skips objects whose definition is missing", () => {
    const layout = makeLayout(10, 10, [{ ...placed("x", sprinkler, 3, 3), defId: "gone" }]);
    expect(getEffectCoverage(layout, defs).size).toBe(0);
  });
});

describe("clampGridSize", () => {
  it("passes through valid sizes", () => {
    expect(clampGridSize(4)).toBe(4);
    expect(clampGridSize(17)).toBe(17);
    expect(clampGridSize(64)).toBe(64);
  });

  it("clamps to 4..64 and rounds", () => {
    expect(clampGridSize(0)).toBe(4);
    expect(clampGridSize(-5)).toBe(4);
    expect(clampGridSize(65)).toBe(64);
    expect(clampGridSize(16.6)).toBe(17);
  });

  it("maps non-finite input to the minimum", () => {
    expect(clampGridSize(NaN)).toBe(4);
    expect(clampGridSize(Infinity)).toBe(4);
  });
});

describe("getObjectsOutsideSize", () => {
  const layout = makeLayout(16, 16, [
    placed("a", barn, 0, 0),
    placed("b", barn, 8, 8),
    placed("c", fence, 10, 14, 90), // occupies (10,14),(10,15)
    { ...placed("d", crop, 15, 15), defId: "gone" },
  ]);
  const ids = (w: number, h: number) => getObjectsOutsideSize(layout, defs, w, h).map((o) => o.id);

  it("reports nothing when everything still fits", () => {
    expect(ids(16, 16)).toEqual([]);
    expect(ids(20, 20)).toEqual([]);
  });

  it("reports objects whose footprint crosses the new edge, not just their origin", () => {
    expect(ids(11, 16)).toEqual(["b"]); // b spans x 8..11
    expect(ids(12, 16)).toEqual([]);
    expect(ids(16, 15)).toEqual(["c"]); // c's second cell is y=15
  });

  it("uses the rotated footprint", () => {
    expect(ids(11, 14)).toEqual(["b", "c"]);
  });

  it("does not report objects with an unknown definition", () => {
    expect(ids(4, 4)).not.toContain("d");
  });
});

describe("getFootprintSize", () => {
  it("returns the definition size at 0 and 180 degrees", () => {
    expect(getFootprintSize(placed("a", fence, 0, 0, 0), fence)).toEqual({ width: 2, height: 1 });
    expect(getFootprintSize(placed("a", fence, 0, 0, 180), fence)).toEqual({ width: 2, height: 1 });
  });

  it("swaps width and height at 90 and 270 degrees", () => {
    expect(getFootprintSize(placed("a", fence, 0, 0, 90), fence)).toEqual({ width: 1, height: 2 });
    expect(getFootprintSize(placed("a", fence, 0, 0, 270), fence)).toEqual({ width: 1, height: 2 });
  });

  it("agrees with the number of cells getFootprint returns", () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const obj = placed("a", barn, 0, 0, rotation);
      const { width, height } = getFootprintSize(obj, barn);
      expect(getFootprint(obj, barn)).toHaveLength(width * height);
    }
  });
});

describe("pointerToCell", () => {
  const origin = { left: 100, top: 50 };

  it("maps a pointer to the cell it is inside", () => {
    expect(pointerToCell(100, 50, origin, 32)).toEqual({ x: 0, y: 0 });
    expect(pointerToCell(131, 81, origin, 32)).toEqual({ x: 0, y: 0 });
    expect(pointerToCell(132, 82, origin, 32)).toEqual({ x: 1, y: 1 });
    expect(pointerToCell(100 + 32 * 5 + 10, 50 + 32 * 3 + 10, origin, 32)).toEqual({ x: 5, y: 3 });
  });

  it("returns negative cells left of and above the grid", () => {
    expect(pointerToCell(99, 49, origin, 32)).toEqual({ x: -1, y: -1 });
    expect(pointerToCell(0, 0, origin, 32)).toEqual({ x: -4, y: -2 });
  });

  it("handles fractional cell sizes", () => {
    expect(pointerToCell(100 + 20.5, 50, origin, 20.5)).toEqual({ x: 1, y: 0 });
  });
});

describe("clampGrab", () => {
  it("leaves an in-range offset alone", () => {
    expect(clampGrab({ dx: 1, dy: 2 }, { width: 4, height: 4 })).toEqual({ dx: 1, dy: 2 });
  });

  it("pulls the offset inside a smaller (e.g. rotated) footprint", () => {
    expect(clampGrab({ dx: 3, dy: 0 }, { width: 1, height: 2 })).toEqual({ dx: 0, dy: 0 });
    expect(clampGrab({ dx: 0, dy: 3 }, { width: 2, height: 1 })).toEqual({ dx: 0, dy: 0 });
  });

  it("never goes negative", () => {
    expect(clampGrab({ dx: -2, dy: -1 }, { width: 3, height: 3 })).toEqual({ dx: 0, dy: 0 });
  });
});

describe("getCellBounds", () => {
  it("is null for no cells", () => {
    expect(getCellBounds([])).toBeNull();
  });

  it("bounds a single cell", () => {
    expect(getCellBounds([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4, width: 1, height: 1 });
  });

  it("matches a clipped effect rectangle exactly", () => {
    const cells = getEffectCells(placed("s", scarecrow, 0, 0), scarecrow, makeLayout(15, 15));
    expect(getCellBounds(cells)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
    expect(cells).toHaveLength(16); // the bounds contain every cell, so none are missing
  });

  it("matches a full effect rectangle", () => {
    const cells = getEffectCells(placed("s", scarecrow, 7, 7), scarecrow, makeLayout(15, 15));
    expect(getCellBounds(cells)).toEqual({ x: 4, y: 4, width: 7, height: 7 });
  });
});

describe("classifyPointer", () => {
  const grid = { left: 100, top: 100, right: 300, bottom: 300 };
  const at = (x: number, y: number, view: typeof grid | null = null, margin = 16) =>
    classifyPointer({ x, y }, grid, view, margin);

  it("is 'over' anywhere inside the grid, including the first cell edge", () => {
    expect(at(150, 150)).toBe("over");
    expect(at(100, 100)).toBe("over");
    expect(at(299, 299)).toBe("over");
  });

  it("treats the far edge as outside (the box is half-open)", () => {
    expect(at(300, 150)).toBe("near");
    expect(at(150, 300)).toBe("near");
  });

  it("forgives overshooting by up to the margin", () => {
    expect(at(90, 150)).toBe("near"); // 10px left of the grid
    expect(at(150, 315)).toBe("near"); // 15px below
    expect(at(84, 150)).toBe("near"); // exactly at the margin
    expect(at(310, 310)).toBe("near"); // diagonal corner band
  });

  it("is 'away' beyond the margin on any side", () => {
    expect(at(83, 150)).toBe("away");
    expect(at(150, 83)).toBe("away");
    expect(at(317, 150)).toBe("away");
    expect(at(150, 317)).toBe("away");
    expect(at(0, 0)).toBe("away");
  });

  it("respects a custom margin", () => {
    expect(at(80, 150, null, 30)).toBe("near");
    expect(at(80, 150, null, 10)).toBe("away");
    expect(at(99, 150, null, 0)).toBe("away");
  });

  describe("with a scrolling view that clips the grid", () => {
    // the grid extends below the view (like a tall board under the phone dock)
    const view = { left: 0, top: 0, right: 400, bottom: 200 };

    it("is 'over' only for the part of the grid that is visible", () => {
      expect(at(150, 150, view)).toBe("over");
      expect(at(150, 250, view)).toBe("away"); // inside the grid box but under the dock
    });

    it("measures the margin from the visible edge, not the hidden grid edge", () => {
      expect(at(150, 210, view)).toBe("near"); // 10px past the view's bottom
      expect(at(150, 230, view)).toBe("away");
    });

    it("is 'away' when none of the grid is visible", () => {
      const farView = { left: 0, top: 500, right: 400, bottom: 600 };
      expect(at(150, 150, farView)).toBe("away");
      expect(at(150, 550, farView)).toBe("away");
    });

    it("behaves as before when the view contains the whole grid", () => {
      const big = { left: -100, top: -100, right: 1000, bottom: 1000 };
      expect(at(150, 150, big)).toBe("over");
      expect(at(90, 150, big)).toBe("near");
      expect(at(0, 0, big)).toBe("away");
    });
  });
});
