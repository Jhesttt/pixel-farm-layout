import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS as SEEDS, withBuiltInsReset } from "../data/builtIns";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";
import { countDefinitionUse, findMisfits } from "../lib/edit";
import { centeredOffset } from "../lib/grid";
import { useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import type { FarmLayout, PlacedObject } from "../types";

const obj = (
  id: string,
  def: string,
  x: number,
  y: number,
  rotation: PlacedObject["rotation"] = 0,
): PlacedObject => ({ id, defId: `builtin-${def}`, x, y, rotation, showEffect: true });

const layoutOf = (width: number, height: number, objects: PlacedObject[]): FarmLayout => ({
  id: "l", name: "t", width, height, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

const withTree = (width: number, height: number) =>
  defs.map((d) => (d.id === "builtin-tree" ? { ...d, width, height } : d));

describe("centeredOffset", () => {
  it("centres odd differences exactly", () => {
    expect(centeredOffset(1, 7)).toBe(-3);
    expect(centeredOffset(1, 3)).toBe(-1);
  });

  it("rounds the shift toward the top-left for even differences", () => {
    expect(centeredOffset(1, 4)).toBe(-1); // 4 wide on 1: one before, two after
    expect(centeredOffset(2, 5)).toBe(-1);
  });

  it("is zero when the effect matches the object and positive when smaller", () => {
    expect(centeredOffset(3, 3)).toBe(0);
    expect(centeredOffset(5, 3)).toBe(1);
  });
});

describe("withBuiltInsReset", () => {
  it("restores edited and deleted built-ins and keeps custom definitions", () => {
    const custom = { id: "custom-1", name: "Shed", width: 3, height: 2, color: "#112233", builtIn: false };
    const mangled = [
      ...SEEDS.filter((d) => d.id !== "builtin-path").map((d) => (d.id === "builtin-crop" ? { ...d, color: "#000000" } : d)),
      custom,
    ];
    const reset = withBuiltInsReset(mangled);
    expect(reset).toHaveLength(SEEDS.length + 1);
    expect(reset.find((d) => d.id === "builtin-crop")?.color).toBe(SEEDS[0]?.color);
    expect(reset.some((d) => d.id === "builtin-path")).toBe(true);
    expect(reset.at(-1)).toEqual(custom);
  });
});

describe("findMisfits", () => {
  it("is empty when everything fits", () => {
    expect(findMisfits(layoutOf(8, 8, [obj("a", "barn", 0, 0), obj("b", "crop", 5, 5)]), defs)).toEqual([]);
  });

  it("reports objects that stick out of the grid under the new definitions", () => {
    const l = layoutOf(8, 8, [obj("t", "tree", 6, 6)]);
    expect(findMisfits(l, defs)).toEqual([]);
    expect(findMisfits(l, withTree(4, 4))).toEqual(["t"]);
  });

  it("reports an object that now overlaps an earlier one, keeping the earlier", () => {
    const l = layoutOf(8, 8, [obj("t", "tree", 0, 0), obj("c", "crop", 3, 0)]);
    expect(findMisfits(l, withTree(4, 2))).toEqual(["c"]);
  });

  it("uses the rotated footprint", () => {
    expect(findMisfits(layoutOf(4, 4, [obj("f", "fence", 3, 3, 90)]), defs)).toEqual(["f"]);
  });

  it("ignores objects with an unknown definition", () => {
    const o = { ...obj("x", "crop", 0, 0), defId: "gone" };
    expect(findMisfits(layoutOf(8, 8, [o]), defs)).toEqual([]);
  });
});

describe("countDefinitionUse", () => {
  it("counts objects and layouts across all layouts", () => {
    const a = layoutOf(8, 8, [obj("1", "crop", 0, 0), obj("2", "crop", 1, 0), obj("3", "tree", 4, 4)]);
    const b = { ...layoutOf(8, 8, [obj("4", "crop", 0, 0)]), id: "b" };
    const c = { ...layoutOf(8, 8, [obj("5", "tree", 0, 0)]), id: "c" };
    expect(countDefinitionUse({ l: a, b, c }, "builtin-crop")).toEqual({ objects: 3, layouts: 2 });
    expect(countDefinitionUse({ l: a, b, c }, "builtin-barn")).toEqual({ objects: 0, layouts: 0 });
  });
});

describe("cross-layout definition cleanup (store)", () => {
  const spot = (defId: string, x: number, y: number): Omit<PlacedObject, "id"> => ({
    defId: `builtin-${defId}`, x, y, rotation: 0, showEffect: true,
  });
  const get = () => useLayoutStore.getState();

  beforeEach(() => {
    useLayoutStore.setState({ layouts: {}, activeLayoutId: null, selection: [] });
  });

  it("removeObjectsByDef removes that definition from every layout and returns the count", () => {
    const a = get().createLayout("a", 8, 8);
    get().placeObject(spot("crop", 0, 0), defs);
    get().placeObject(spot("crop", 2, 0), defs);
    get().placeObject(spot("tree", 4, 4), defs);
    const b = get().createLayout("b", 8, 8);
    get().placeObject(spot("crop", 1, 1), defs);
    expect(get().removeObjectsByDef("builtin-crop")).toBe(3);
    expect(get().layouts[a]?.objects.map((o) => o.defId)).toEqual(["builtin-tree"]);
    expect(get().layouts[b]?.objects).toEqual([]);
  });

  it("removeObjectsByDef prunes the selection and does nothing when unused", () => {
    get().createLayout("a", 8, 8);
    const id = get().placeObject(spot("crop", 0, 0), defs)!;
    get().setSelection([id]);
    expect(get().removeObjectsByDef("builtin-barn")).toBe(0);
    expect(get().selection).toEqual([id]);
    get().removeObjectsByDef("builtin-crop");
    expect(get().selection).toEqual([]);
  });

  it("removeMisfitObjects removes what no longer fits after a footprint grows", () => {
    const a = get().createLayout("a", 8, 8);
    get().placeObject(spot("tree", 0, 0), defs);
    get().placeObject(spot("tree", 6, 6), defs);
    expect(get().removeMisfitObjects(withTree(4, 4))).toBe(1);
    expect(get().layouts[a]?.objects.map((o) => `${o.x},${o.y}`)).toEqual(["0,0"]);
  });

  it("removeMisfitObjects changes nothing when all still fit", () => {
    const a = get().createLayout("a", 8, 8);
    get().placeObject(spot("tree", 0, 0), defs);
    const before = get().layouts[a];
    expect(get().removeMisfitObjects(defs)).toBe(0);
    expect(get().layouts[a]).toBe(before);
  });
});

describe("library updateDefinition", () => {
  beforeEach(() => {
    useLibraryStore.setState({ definitions: defs });
  });

  it("an undefined icon or effect removes the key instead of leaving it", () => {
    useLibraryStore.getState().updateDefinition("builtin-scarecrow", { effect: undefined, icon: undefined });
    const d = useLibraryStore.getState().definitions.find((x) => x.id === "builtin-scarecrow")!;
    expect(d).not.toHaveProperty("effect");
    expect(d).not.toHaveProperty("icon");
  });
});
