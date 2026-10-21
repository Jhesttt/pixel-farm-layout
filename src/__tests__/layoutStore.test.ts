import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS } from "../data/builtIns";
import { useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import type { PlacedObject } from "../types";

const defs = BUILT_IN_DEFINITIONS;
const barn = (id: string, x: number, y: number): PlacedObject => ({
  id,
  defId: "builtin-barn",
  x,
  y,
  rotation: 0,
  showEffect: true,
});

beforeEach(() => {
  useLayoutStore.setState({ layouts: {}, activeLayoutId: null });
});

const get = () => useLayoutStore.getState();

describe("layout store", () => {
  it("createLayout adds an empty layout and makes it active", () => {
    const id = get().createLayout("  My Farm ", 17, 15);
    const layout = get().layouts[id];
    expect(get().activeLayoutId).toBe(id);
    expect(layout).toMatchObject({ id, name: "My Farm", width: 17, height: 15, objects: [], schemaVersion: 1 });
    expect(layout?.createdAt).toBe(layout?.updatedAt);
  });

  it("createLayout clamps size to 4..64 and names blank layouts", () => {
    const id = get().createLayout("   ", 2, 500);
    expect(get().layouts[id]).toMatchObject({ name: "Untitled", width: 4, height: 64 });
  });

  it("setActiveLayout ignores unknown ids", () => {
    const id = get().createLayout("a", 10, 10);
    get().setActiveLayout("nope");
    expect(get().activeLayoutId).toBe(id);
  });

  it("deleteLayout of the active layout activates the most recently updated remaining one", () => {
    const a = get().createLayout("a", 10, 10);
    const b = get().createLayout("b", 10, 10);
    const c = get().createLayout("c", 10, 10);
    useLayoutStore.setState((s) => ({
      layouts: {
        ...s.layouts,
        [a]: { ...s.layouts[a]!, updatedAt: 100 },
        [b]: { ...s.layouts[b]!, updatedAt: 300 },
        [c]: { ...s.layouts[c]!, updatedAt: 200 },
      },
      activeLayoutId: c,
    }));
    get().deleteLayout(c);
    expect(Object.keys(get().layouts).sort()).toEqual([a, b].sort());
    expect(get().activeLayoutId).toBe(b);
  });

  it("deleteLayout of an inactive layout keeps the active one", () => {
    const a = get().createLayout("a", 10, 10);
    const b = get().createLayout("b", 10, 10);
    get().deleteLayout(a);
    expect(get().activeLayoutId).toBe(b);
  });

  it("deleting the last layout leaves no active layout", () => {
    const a = get().createLayout("a", 10, 10);
    get().deleteLayout(a);
    expect(get().layouts).toEqual({});
    expect(get().activeLayoutId).toBeNull();
  });

  it("renameLayout trims, ignores blank names, and bumps updatedAt", () => {
    const id = get().createLayout("old", 10, 10);
    useLayoutStore.setState((s) => ({ layouts: { ...s.layouts, [id]: { ...s.layouts[id]!, updatedAt: 1 } } }));
    get().renameLayout(id, "   ");
    expect(get().layouts[id]?.name).toBe("old");
    get().renameLayout(id, " new ");
    expect(get().layouts[id]?.name).toBe("new");
    expect(get().layouts[id]?.updatedAt).toBeGreaterThan(1);
  });

  describe("resizeLayout", () => {
    it("changes the size and clamps it", () => {
      const id = get().createLayout("a", 10, 10);
      get().resizeLayout(id, 20, 1000, defs);
      expect(get().layouts[id]).toMatchObject({ width: 20, height: 64 });
    });

    it("keeps objects that still fit and drops those that fall out of bounds", () => {
      const id = get().createLayout("a", 16, 16);
      useLayoutStore.setState((s) => ({
        layouts: {
          ...s.layouts,
          [id]: { ...s.layouts[id]!, objects: [barn("keep", 0, 0), barn("edge", 8, 8), barn("gone", 12, 12)] },
        },
      }));
      get().resizeLayout(id, 12, 12, defs);
      expect(get().layouts[id]?.objects.map((o) => o.id)).toEqual(["keep", "edge"]);
    });

    it("is a no-op when the size is unchanged", () => {
      const id = get().createLayout("a", 10, 10);
      const before = get().layouts[id];
      get().resizeLayout(id, 10, 10, defs);
      expect(get().layouts[id]).toBe(before);
    });
  });
});

describe("library store", () => {
  beforeEach(() => {
    useLibraryStore.setState({ definitions: BUILT_IN_DEFINITIONS });
  });
  const lib = () => useLibraryStore.getState();

  it("seeds the eight built-ins", () => {
    expect(lib().definitions.map((d) => d.name)).toEqual([
      "Crop", "Tree", "Barn", "Scarecrow", "Sprinkler", "Path", "Fence", "Water",
    ]);
    expect(lib().definitions.every((d) => d.builtIn)).toBe(true);
  });

  it("addDefinition creates a custom definition with a fresh id", () => {
    const id = lib().addDefinition({ name: "Shed", width: 3, height: 2, color: "#112233" });
    expect(lib().definitions.find((d) => d.id === id)).toMatchObject({ name: "Shed", builtIn: false });
  });

  it("updateDefinition and deleteDefinition touch only the target", () => {
    lib().updateDefinition("builtin-crop", { color: "#000000" });
    expect(lib().definitions.find((d) => d.id === "builtin-crop")?.color).toBe("#000000");
    lib().deleteDefinition("builtin-tree");
    expect(lib().definitions).toHaveLength(7);
  });

  it("resetBuiltIns restores edited and deleted built-ins and keeps custom ones", () => {
    const custom = lib().addDefinition({ name: "Shed", width: 3, height: 2, color: "#112233" });
    lib().updateDefinition("builtin-crop", { color: "#000000" });
    lib().deleteDefinition("builtin-tree");
    lib().resetBuiltIns();
    expect(lib().definitions.find((d) => d.id === "builtin-crop")?.color).toBe(BUILT_IN_DEFINITIONS[0]?.color);
    expect(lib().definitions.some((d) => d.id === "builtin-tree")).toBe(true);
    expect(lib().definitions.some((d) => d.id === custom)).toBe(true);
    expect(lib().definitions).toHaveLength(9);
  });
});

describe("placeObject and moveObject", () => {
  const crop = (x: number, y: number): Omit<PlacedObject, "id"> => ({
    defId: "builtin-crop", x, y, rotation: 0, showEffect: true,
  });
  const fence = (x: number, y: number, rotation: PlacedObject["rotation"] = 0): Omit<PlacedObject, "id"> => ({
    defId: "builtin-fence", x, y, rotation, showEffect: true,
  });
  const active = () => get().layouts[get().activeLayoutId!]!;

  it("placeObject adds to the active layout and returns the new id", () => {
    get().createLayout("a", 8, 8);
    const id = get().placeObject(crop(2, 3), defs);
    expect(id).toEqual(expect.any(String));
    expect(active().objects).toEqual([{ ...crop(2, 3), id }]);
  });

  it("placeObject bumps updatedAt", () => {
    const layoutId = get().createLayout("a", 8, 8);
    useLayoutStore.setState((s) => ({ layouts: { ...s.layouts, [layoutId]: { ...s.layouts[layoutId]!, updatedAt: 1 } } }));
    get().placeObject(crop(0, 0), defs);
    expect(active().updatedAt).toBeGreaterThan(1);
  });

  it("placeObject refuses out-of-bounds, overlapping and unknown-definition placements", () => {
    get().createLayout("a", 8, 8);
    get().placeObject(crop(2, 2), defs);
    expect(get().placeObject(crop(8, 0), defs)).toBeNull();
    expect(get().placeObject(crop(-1, 0), defs)).toBeNull();
    expect(get().placeObject(crop(2, 2), defs)).toBeNull();
    expect(get().placeObject({ ...crop(0, 0), defId: "gone" }, defs)).toBeNull();
    expect(active().objects).toHaveLength(1);
  });

  it("placeObject does nothing without an active layout", () => {
    expect(get().placeObject(crop(0, 0), defs)).toBeNull();
  });

  it("placeObject respects the rotated footprint", () => {
    get().createLayout("a", 4, 4);
    expect(get().placeObject(fence(0, 3, 90), defs)).toBeNull(); // 1x2 would stick out below
    expect(get().placeObject(fence(0, 3, 0), defs)).not.toBeNull();
  });

  it("moveObject moves to a free spot", () => {
    get().createLayout("a", 8, 8);
    const id = get().placeObject(crop(1, 1), defs)!;
    expect(get().moveObject(id, 5, 6, defs)).toBe(true);
    expect(active().objects[0]).toMatchObject({ id, x: 5, y: 6 });
  });

  it("moveObject can overlap the object's own old footprint", () => {
    get().createLayout("a", 8, 8);
    const id = get().placeObject({ ...fence(1, 1) }, defs)!;
    expect(get().moveObject(id, 2, 1, defs)).toBe(true); // shifts by one, overlapping itself
  });

  it("moveObject refuses occupied and out-of-bounds targets and leaves the object alone", () => {
    get().createLayout("a", 8, 8);
    const a = get().placeObject(crop(1, 1), defs)!;
    get().placeObject(crop(4, 4), defs);
    expect(get().moveObject(a, 4, 4, defs)).toBe(false);
    expect(get().moveObject(a, 8, 1, defs)).toBe(false);
    expect(active().objects.find((o) => o.id === a)).toMatchObject({ x: 1, y: 1 });
  });

  it("moveObject applies a rotation, checked against the rotated footprint", () => {
    get().createLayout("a", 4, 4);
    const id = get().placeObject(fence(0, 3), defs)!;
    expect(get().moveObject(id, 0, 3, defs, 90)).toBe(false); // rotated, it would leave the grid
    expect(active().objects[0]?.rotation).toBe(0);
    expect(get().moveObject(id, 0, 2, defs, 90)).toBe(true);
    expect(active().objects[0]).toMatchObject({ x: 0, y: 2, rotation: 90 });
  });

  it("moveObject returns false for an unknown id", () => {
    get().createLayout("a", 8, 8);
    expect(get().moveObject("nope", 0, 0, defs)).toBe(false);
  });

  it("only touches the active layout", () => {
    const first = get().createLayout("first", 8, 8);
    get().placeObject(crop(0, 0), defs);
    get().createLayout("second", 8, 8);
    get().placeObject(crop(0, 0), defs);
    expect(get().layouts[first]?.objects).toHaveLength(1);
    expect(active().objects).toHaveLength(1);
  });
});

describe("selection and editing actions", () => {
  const spot = (defId: string, x: number, y: number, rotation: PlacedObject["rotation"] = 0): Omit<PlacedObject, "id"> => ({
    defId: `builtin-${defId}`, x, y, rotation, showEffect: true,
  });
  const active = () => get().layouts[get().activeLayoutId!]!;
  const place = (...args: Parameters<typeof spot>) => get().placeObject(spot(...args), defs)!;

  beforeEach(() => {
    useLayoutStore.setState({ selection: [] });
  });

  it("setSelection and toggleSelected manage the selected ids", () => {
    get().setSelection(["a", "b"]);
    get().toggleSelected("c");
    expect(get().selection).toEqual(["a", "b", "c"]);
    get().toggleSelected("a");
    expect(get().selection).toEqual(["b", "c"]);
  });

  it("selection is cleared when the active layout changes", () => {
    const first = get().createLayout("one", 8, 8);
    get().createLayout("two", 8, 8);
    get().setSelection(["x"]);
    get().setActiveLayout(first);
    expect(get().selection).toEqual([]);
    get().setSelection(["x"]);
    get().createLayout("three", 8, 8);
    expect(get().selection).toEqual([]);
  });

  it("deleting the active layout clears the selection; deleting another keeps it", () => {
    const a = get().createLayout("a", 8, 8);
    const b = get().createLayout("b", 8, 8);
    get().setSelection(["x"]);
    get().deleteLayout(a);
    expect(get().selection).toEqual(["x"]);
    get().deleteLayout(b);
    expect(get().selection).toEqual([]);
  });

  it("removeObjects deletes them and prunes the selection", () => {
    get().createLayout("a", 8, 8);
    const a = place("crop", 0, 0);
    const b = place("crop", 2, 0);
    const c = place("crop", 4, 0);
    get().setSelection([a, b, c]);
    get().removeObjects([a, b]);
    expect(active().objects.map((o) => o.id)).toEqual([c]);
    expect(get().selection).toEqual([c]);
  });

  it("removeObjects ignores ids that are not in the layout", () => {
    get().createLayout("a", 8, 8);
    place("crop", 0, 0);
    const before = active();
    get().removeObjects(["nope"]);
    expect(active()).toBe(before);
  });

  it("resizeLayout drops removed objects from the selection", () => {
    const id = get().createLayout("a", 16, 16);
    const keep = place("crop", 0, 0);
    const gone = place("crop", 14, 14);
    get().setSelection([keep, gone]);
    get().resizeLayout(id, 8, 8, defs);
    expect(get().selection).toEqual([keep]);
  });

  it("rotateObjects turns the objects and leaves others alone", () => {
    get().createLayout("a", 8, 8);
    const a = place("fence", 0, 0);
    const b = place("fence", 4, 4);
    get().rotateObjects([a], defs);
    expect(active().objects.find((o) => o.id === a)?.rotation).toBe(90);
    expect(active().objects.find((o) => o.id === b)?.rotation).toBe(0);
  });

  it("rotateObjects shifts an edge object back inside the grid", () => {
    get().createLayout("a", 4, 4);
    const id = place("fence", 0, 3);
    get().rotateObjects([id], defs);
    expect(active().objects[0]).toMatchObject({ x: 0, y: 2, rotation: 90 });
  });

  it("nudgeObjects moves the group, or nothing when blocked", () => {
    get().createLayout("a", 4, 4);
    const a = place("crop", 2, 0);
    const b = place("crop", 3, 0);
    expect(get().nudgeObjects([a, b], 1, 0, defs)).toBe(false);
    expect(active().objects.map((o) => o.x)).toEqual([2, 3]);
    expect(get().nudgeObjects([a, b], 0, 1, defs)).toBe(true);
    expect(active().objects.map((o) => o.y)).toEqual([1, 1]);
  });

  it("updateObjects sets and clears label and colour, and toggles the effect", () => {
    get().createLayout("a", 8, 8);
    const id = place("scarecrow", 1, 1);
    get().updateObjects([id], { label: "North", colorOverride: "#aabbcc", showEffect: false });
    expect(active().objects[0]).toMatchObject({ label: "North", colorOverride: "#aabbcc", showEffect: false });
    get().updateObjects([id], { label: "", colorOverride: undefined });
    expect(active().objects[0]).not.toHaveProperty("label");
    expect(active().objects[0]).not.toHaveProperty("colorOverride");
    expect(active().objects[0]?.showEffect).toBe(false);
  });

  it("updateObjects edits several objects at once and skips others", () => {
    get().createLayout("a", 8, 8);
    const a = place("crop", 0, 0);
    const b = place("crop", 2, 0);
    const c = place("crop", 4, 0);
    get().updateObjects([a, b], { colorOverride: "#112233" });
    expect(active().objects.map((o) => o.colorOverride)).toEqual(["#112233", "#112233", undefined]);
    expect(c).toBeTruthy();
  });

  it("duplicateObjects adds copies, selects them, and keeps the originals", () => {
    get().createLayout("a", 8, 8);
    const id = place("crop", 2, 2);
    const copies = get().duplicateObjects([id], defs);
    expect(copies).toHaveLength(1);
    expect(active().objects).toHaveLength(2);
    expect(get().selection).toEqual(copies);
    expect(active().objects.find((o) => o.id === copies[0])).toMatchObject({ x: 3, y: 3 });
  });

  it("duplicateObjects does nothing when there is no room", () => {
    get().createLayout("a", 4, 4);
    const id = place("barn", 0, 0);
    expect(get().duplicateObjects([id], defs)).toEqual([]);
    expect(active().objects).toHaveLength(1);
  });

  it("setView merges display toggles and defaults all on", () => {
    expect(get().view).toEqual({ showGrid: true, showLabels: true, showEffects: true });
    get().setView({ showGrid: false });
    expect(get().view).toEqual({ showGrid: false, showLabels: true, showEffects: true });
    get().setView({ showGrid: true });
  });
});
