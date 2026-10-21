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
