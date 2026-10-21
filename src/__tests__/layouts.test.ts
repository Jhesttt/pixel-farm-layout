import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS } from "../data/builtIns";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";
import { exportAllText, exportLayoutText, importFromText } from "../store/exchange";
import { useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import type { ObjectDefinition, PlacedObject } from "../types";

const get = () => useLayoutStore.getState();
const lib = () => useLibraryStore.getState();
const spot = (defId: string, x: number, y: number): Omit<PlacedObject, "id"> => ({
  defId, x, y, rotation: 0, showEffect: true,
});

beforeEach(() => {
  useLayoutStore.setState({ layouts: {}, activeLayoutId: null, selection: [], history: { past: [], future: [] } });
  useLibraryStore.setState({ definitions: defs });
});

describe("duplicateLayout", () => {
  it("copies size and objects as '<name> copy', activates the copy, and leaves the original", () => {
    const id = get().createLayout("Home", 12, 10);
    get().placeObject(spot("builtin-crop", 1, 1), defs);
    const copyId = get().duplicateLayout(id)!;
    expect(copyId).not.toBe(id);
    expect(get().activeLayoutId).toBe(copyId);
    expect(get().layouts[copyId]).toMatchObject({ name: "Home copy", width: 12, height: 10 });
    expect(get().layouts[copyId]?.objects).toEqual(get().layouts[id]?.objects);
    expect(get().layouts[id]?.name).toBe("Home");
  });

  it("makes an independent copy: editing one does not change the other", () => {
    const id = get().createLayout("Home", 8, 8);
    get().placeObject(spot("builtin-crop", 1, 1), defs);
    const copyId = get().duplicateLayout(id)!;
    get().placeObject(spot("builtin-crop", 5, 5), defs);
    expect(get().layouts[copyId]?.objects).toHaveLength(2);
    expect(get().layouts[id]?.objects).toHaveLength(1);
  });

  it("resets selection and history, and returns null for an unknown id", () => {
    const id = get().createLayout("Home", 8, 8);
    get().placeObject(spot("builtin-crop", 1, 1), defs);
    get().setSelection(["x"]);
    get().duplicateLayout(id);
    expect(get().selection).toEqual([]);
    expect(get().history).toEqual({ past: [], future: [] });
    expect(get().duplicateLayout("nope")).toBeNull();
  });
});

describe("export and import through the stores", () => {
  const shed: ObjectDefinition = { id: "custom-shed", name: "Shed", width: 3, height: 2, color: "#112233", builtIn: false };

  it("returns null when there is nothing to export", () => {
    expect(exportLayoutText("nope")).toBeNull();
    expect(exportAllText()).toBeNull();
  });

  it("imports an exported layout as a new layout, leaving the original in place", () => {
    const id = get().createLayout("Home", 10, 10);
    get().placeObject(spot("builtin-crop", 2, 2), defs);
    const text = exportLayoutText(id)!;
    const result = importFromText(text);
    expect(result).toMatchObject({ ok: true, names: ["Home"] });
    expect(Object.keys(get().layouts)).toHaveLength(2);
    expect(get().activeLayoutId).not.toBe(id);
    const imported = get().layouts[get().activeLayoutId!]!;
    expect(imported.objects).toHaveLength(1);
    expect(imported.id).not.toBe(id);
  });

  it("brings along custom definitions that the library lacks", () => {
    useLibraryStore.setState({ definitions: [...defs, shed] });
    const id = get().createLayout("Yard", 10, 10);
    get().placeObject(spot("custom-shed", 1, 1), [...defs, shed]);
    const text = exportLayoutText(id)!;

    useLibraryStore.setState({ definitions: defs }); // as on another machine
    useLayoutStore.setState({ layouts: {}, activeLayoutId: null });
    const result = importFromText(text);
    expect(result).toMatchObject({ ok: true, report: { addedDefinitions: 1, droppedUnknown: 0 } });
    expect(lib().definitions.find((d) => d.id === "custom-shed")).toMatchObject({ name: "Shed", builtIn: false });
    expect(get().layouts[get().activeLayoutId!]?.objects).toHaveLength(1);
  });

  it("keeps the local definition when the id already exists", () => {
    useLibraryStore.setState({ definitions: [...defs, shed] });
    const id = get().createLayout("Yard", 10, 10);
    get().placeObject(spot("custom-shed", 1, 1), [...defs, shed]);
    const text = exportLayoutText(id)!;
    useLibraryStore.setState({ definitions: [...defs, { ...shed, color: "#ffffff" }] });
    importFromText(text);
    expect(lib().definitions.find((d) => d.id === "custom-shed")?.color).toBe("#ffffff");
  });

  it("export all then import restores every layout", () => {
    get().createLayout("One", 8, 8);
    get().placeObject(spot("builtin-crop", 0, 0), defs);
    get().createLayout("Two", 9, 9);
    const text = exportAllText()!;
    useLayoutStore.setState({ layouts: {}, activeLayoutId: null });
    const result = importFromText(text);
    expect(result).toMatchObject({ ok: true });
    expect(Object.values(get().layouts).map((l) => l.name).sort()).toEqual(["One", "Two"]);
  });

  it("rejects a bad file without changing anything", () => {
    get().createLayout("Home", 8, 8);
    const before = get().layouts;
    const result = importFromText("{not json");
    expect(result).toMatchObject({ ok: false });
    expect(get().layouts).toBe(before);
  });
});

describe("mergeDefinitions", () => {
  it("adds only unknown ids and marks them custom, except genuine built-in ids", () => {
    const seed = (id: string) => BUILT_IN_DEFINITIONS.find((d) => d.id === id)!;
    useLibraryStore.setState({ definitions: BUILT_IN_DEFINITIONS.filter((d) => d.id !== "builtin-scarecrow") });
    const incoming: ObjectDefinition[] = [
      { ...seed("builtin-scarecrow"), builtIn: false },
      { id: "x1", name: "X", width: 1, height: 1, color: "#123456", builtIn: true },
    ];
    expect(lib().mergeDefinitions(incoming)).toBe(2);
    expect(lib().definitions.find((d) => d.id === "builtin-scarecrow")?.builtIn).toBe(true);
    expect(lib().definitions.find((d) => d.id === "x1")?.builtIn).toBe(false);
    expect(lib().mergeDefinitions(incoming)).toBe(0);
  });
});
