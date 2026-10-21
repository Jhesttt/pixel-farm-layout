import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS, RETIRED_BUILTIN_IDS, withBuiltInsReset } from "../data/builtIns";
import { getEffectCells, getFootprint } from "../lib/grid";
import { objectDefinitionSchema } from "../lib/schemas";
import { useLayoutStore } from "../store/layoutStore";
import { LIBRARY_VERSION, useLibraryStore } from "../store/libraryStore";
import { removeRetiredPlacements } from "../store/retired";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

const byName = (name: string) => {
  const def = BUILT_IN_DEFINITIONS.find((d) => d.name === name);
  if (!def) throw new Error(`no built-in named ${name}`);
  return def;
};

const placed = (def: ObjectDefinition, x: number, y: number): PlacedObject => ({
  id: "p", defId: def.id, x, y, rotation: 0, showEffect: true,
});

const board = (size: number): FarmLayout => ({
  id: "l", name: "t", width: size, height: size, objects: [], createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

describe("shipped built-ins", () => {
  it("are exactly: three crop sizes, scarecrow, three orbs, path", () => {
    expect(BUILT_IN_DEFINITIONS.map((d) => d.name)).toEqual([
      "Crop", "Crop 2×2", "Crop 4×4", "Scarecrow", "Element orb", "Water orb", "Rain orb", "Path",
    ]);
  });

  it("no longer include the retired objects", () => {
    const names = BUILT_IN_DEFINITIONS.map((d) => d.name);
    for (const gone of ["Tree", "Barn", "Sprinkler", "Fence", "Water"]) expect(names).not.toContain(gone);
    const ids = BUILT_IN_DEFINITIONS.map((d) => d.id);
    for (const id of RETIRED_BUILTIN_IDS) expect(ids).not.toContain(id);
  });

  it("have unique ids, all marked built-in, all valid for storage", () => {
    const ids = BUILT_IN_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of BUILT_IN_DEFINITIONS) {
      expect(d.builtIn).toBe(true);
      expect(objectDefinitionSchema.safeParse(d).success, d.name).toBe(true);
    }
  });

  it("give crops three footprints, 1x1, 2x2 and 4x4, without an area of effect", () => {
    const sizes = ["Crop", "Crop 2×2", "Crop 4×4"].map((n) => [byName(n).width, byName(n).height]);
    expect(sizes).toEqual([[1, 1], [2, 2], [4, 4]]);
    for (const n of ["Crop", "Crop 2×2", "Crop 4×4"]) expect(byName(n).effect).toBeUndefined();
  });

  it.each([
    ["Scarecrow", 15],
    ["Element orb", 13],
    ["Water orb", 5],
    ["Rain orb", 7],
  ])("%s is 1x1 and covers %d x %d, centred", (name, reach) => {
    const def = byName(name);
    expect([def.width, def.height]).toEqual([1, 1]);
    expect(def.effect).toMatchObject({ width: reach, height: reach, offsetX: -(reach - 1) / 2, offsetY: -(reach - 1) / 2, shape: "rect" });
  });

  it("cover the stated area on a grid big enough to hold it", () => {
    for (const [name, reach] of [["Scarecrow", 15], ["Element orb", 13], ["Water orb", 5], ["Rain orb", 7]] as const) {
      const def = byName(name);
      const centre = Math.floor(reach / 2);
      const cells = getEffectCells(placed(def, centre, centre), def, board(reach));
      expect(cells, name).toHaveLength(reach * reach);
    }
  });

  it("clip a scarecrow's 15x15 reach to a smaller grid", () => {
    const scarecrow = byName("Scarecrow");
    expect(getEffectCells(placed(scarecrow, 4, 4), scarecrow, board(8))).toHaveLength(64); // covers it all
    expect(getEffectCells(placed(scarecrow, 0, 0), scarecrow, board(20))).toHaveLength(8 * 8);
  });

  it("place crops with their full footprint", () => {
    expect(getFootprint(placed(byName("Crop 4×4"), 2, 3), byName("Crop 4×4"))).toHaveLength(16);
    expect(getFootprint(placed(byName("Crop 2×2"), 2, 3), byName("Crop 2×2"))).toHaveLength(4);
  });
});

describe("library migration to v2", () => {
  const migrate = (saved: ObjectDefinition[], version: number) =>
    useLibraryStore.persist.getOptions().migrate!({ definitions: saved }, version) as { definitions: ObjectDefinition[] };

  const oldTree: ObjectDefinition = { id: "builtin-tree", name: "Tree", width: 2, height: 2, color: "#3e6a4b", builtIn: true };
  const oldScarecrow = { ...byName("Scarecrow"), effect: { ...byName("Scarecrow").effect!, width: 7, height: 7, offsetX: -3, offsetY: -3 } };
  const custom: ObjectDefinition = { id: "custom-shed", name: "Shed", width: 3, height: 2, color: "#112233", builtIn: false };

  it("is the current version", () => {
    expect(LIBRARY_VERSION).toBe(2);
  });

  it("drops retired built-ins, refreshes the others to the new seeds, and keeps custom objects", () => {
    const result = migrate([oldTree, oldScarecrow, custom], 1).definitions;
    expect(result.some((d) => d.id === "builtin-tree")).toBe(false);
    expect(result.find((d) => d.id === "builtin-scarecrow")?.effect?.width).toBe(15);
    expect(result.find((d) => d.id === "custom-shed")).toEqual(custom);
    expect(result.filter((d) => d.builtIn).map((d) => d.id)).toEqual(BUILT_IN_DEFINITIONS.map((d) => d.id));
  });

  it("adds the new built-ins that an old library never had", () => {
    const names = migrate([oldTree], 1).definitions.map((d) => d.name);
    expect(names).toContain("Rain orb");
    expect(names).toContain("Crop 4×4");
  });

  it("leaves an already-current library alone", () => {
    const saved = [...BUILT_IN_DEFINITIONS, custom];
    expect(migrate(saved, 2).definitions).toBe(saved);
  });

  it("matches what resetBuiltIns would produce", () => {
    expect(migrate([custom], 1).definitions).toEqual(withBuiltInsReset([custom]));
  });
});

describe("removeRetiredPlacements", () => {
  const get = () => useLayoutStore.getState();
  const spot = (defId: string, x: number, y: number): Omit<PlacedObject, "id"> => ({
    defId, x, y, rotation: 0, showEffect: true,
  });
  const oldTree: ObjectDefinition = { id: "builtin-tree", name: "Tree", width: 2, height: 2, color: "#3e6a4b", builtIn: false };

  beforeEach(() => {
    useLayoutStore.setState({ layouts: {}, activeLayoutId: null, selection: [], history: { past: [], future: [] } });
    useLibraryStore.setState({ definitions: BUILT_IN_DEFINITIONS });
  });

  it("removes placements of retired built-ins from every layout and leaves others", () => {
    const legacy = [...BUILT_IN_DEFINITIONS, oldTree];
    const a = get().createLayout("a", 8, 8);
    get().placeObject(spot("builtin-tree", 0, 0), legacy);
    get().placeObject(spot("builtin-crop", 5, 5), legacy);
    const b = get().createLayout("b", 8, 8);
    get().placeObject(spot("builtin-tree", 2, 2), legacy);
    expect(removeRetiredPlacements()).toBe(2);
    expect(get().layouts[a]?.objects.map((o) => o.defId)).toEqual(["builtin-crop"]);
    expect(get().layouts[b]?.objects).toEqual([]);
  });

  it("is a no-op the second time, and when nothing uses a retired built-in", () => {
    get().createLayout("a", 8, 8);
    get().placeObject(spot("builtin-crop", 1, 1), BUILT_IN_DEFINITIONS);
    expect(removeRetiredPlacements()).toBe(0);
    expect(removeRetiredPlacements()).toBe(0);
  });

  it("leaves a retired id alone when the library still has it (an import added it as custom)", () => {
    useLibraryStore.setState({ definitions: [...BUILT_IN_DEFINITIONS, oldTree] });
    get().createLayout("a", 8, 8);
    get().placeObject(spot("builtin-tree", 0, 0), [...BUILT_IN_DEFINITIONS, oldTree]);
    expect(removeRetiredPlacements()).toBe(0);
    expect(get().layouts[get().activeLayoutId!]?.objects).toHaveLength(1);
  });
});
