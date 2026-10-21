import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS as defs } from "../data/builtIns";
import { HISTORY_LIMIT, useLayoutStore } from "../store/layoutStore";
import type { PlacedObject } from "../types";

const get = () => useLayoutStore.getState();
const active = () => get().layouts[get().activeLayoutId!]!;
const spot = (
  defId: string,
  x: number,
  y: number,
  rotation: PlacedObject["rotation"] = 0,
): Omit<PlacedObject, "id"> => ({ defId: `builtin-${defId}`, x, y, rotation, showEffect: true });
const place = (...args: Parameters<typeof spot>) => get().placeObject(spot(...args), defs)!;
const positions = () => active().objects.map((o) => `${o.defId.slice(8)}@${o.x},${o.y}`);

beforeEach(() => {
  useLayoutStore.setState({
    layouts: {},
    activeLayoutId: null,
    selection: [],
    history: { past: [], future: [] },
  });
  get().createLayout("test", 16, 16);
});

describe("undo and redo", () => {
  it("starts with nothing to undo or redo, and both are harmless", () => {
    expect(get().history).toEqual({ past: [], future: [] });
    const before = get().layouts;
    get().undo();
    get().redo();
    expect(get().layouts).toBe(before);
  });

  it("undoes and redoes a placement", () => {
    place("crop", 1, 1);
    expect(positions()).toEqual(["crop@1,1"]);
    get().undo();
    expect(positions()).toEqual([]);
    get().redo();
    expect(positions()).toEqual(["crop@1,1"]);
  });

  it("steps back through several changes in order", () => {
    const id = place("crop", 0, 0);
    get().moveObject(id, 5, 5, defs);
    get().rotateObjects([id], defs);
    get().updateObjects([id], { label: "A" });
    get().undo();
    expect(active().objects[0]?.label).toBeUndefined();
    get().undo();
    expect(active().objects[0]).toMatchObject({ x: 5, y: 5, rotation: 0 });
    get().undo();
    expect(active().objects[0]).toMatchObject({ x: 0, y: 0 });
    get().undo();
    expect(positions()).toEqual([]);
    get().redo(); // the placement
    expect(active().objects[0]).toMatchObject({ x: 0, y: 0 });
    get().redo(); // the move
    expect(active().objects[0]).toMatchObject({ x: 5, y: 5, rotation: 0 });
  });

  it("covers removal, nudging, duplication and colour changes", () => {
    const id = place("crop", 2, 2);
    get().nudgeObjects([id], 1, 0, defs);
    get().duplicateObjects([id], defs);
    get().updateObjects([id], { colorOverride: "#112233" });
    get().removeObjects([id]);
    expect(active().objects).toHaveLength(1);
    get().undo();
    expect(active().objects).toHaveLength(2);
    get().undo();
    expect(active().objects.find((o) => o.id === id)?.colorOverride).toBeUndefined();
    get().undo();
    expect(active().objects).toHaveLength(1);
    get().undo();
    expect(active().objects[0]).toMatchObject({ x: 2, y: 2 });
  });

  it("a new change after an undo drops the redo history", () => {
    place("crop", 0, 0);
    place("crop", 3, 3);
    get().undo();
    expect(get().history.future).toHaveLength(1);
    place("tree", 8, 8);
    expect(get().history.future).toEqual([]);
    get().redo();
    expect(positions()).toEqual(["crop@0,0", "tree@8,8"]);
  });

  it("undoes and redoes a rename", () => {
    get().renameLayout(get().activeLayoutId!, "Renamed");
    expect(active().name).toBe("Renamed");
    get().undo();
    expect(active().name).toBe("test");
    get().redo();
    expect(active().name).toBe("Renamed");
  });

  it("undoes a resize that dropped objects, bringing them back", () => {
    place("crop", 14, 14);
    place("crop", 1, 1);
    get().resizeLayout(get().activeLayoutId!, 8, 8, defs);
    expect(positions()).toEqual(["crop@1,1"]);
    expect(active().width).toBe(8);
    get().undo();
    expect(positions()).toEqual(["crop@14,14", "crop@1,1"]);
    expect(active()).toMatchObject({ width: 16, height: 16 });
  });

  it("does not record a change that leaves the objects as they were", () => {
    const id = place("crop", 4, 4);
    const depth = get().history.past.length;
    get().moveObject(id, 4, 4, defs);
    get().updateObjects([id], { showEffect: true });
    get().rotateObjects(["nope"], defs);
    expect(get().history.past).toHaveLength(depth);
  });

  it("does not record a rejected placement or move", () => {
    const a = place("crop", 1, 1);
    place("crop", 2, 2);
    const depth = get().history.past.length;
    expect(get().placeObject(spot("crop", 1, 1), defs)).toBeNull();
    expect(get().moveObject(a, 2, 2, defs)).toBe(false);
    expect(get().history.past).toHaveLength(depth);
  });

  it("keeps only the last HISTORY_LIMIT steps", () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) place("crop", i % 16, Math.floor(i / 16));
    expect(get().history.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) get().undo();
    expect(active().objects).toHaveLength(10); // the 10 oldest placements are no longer undoable
    expect(get().history.past).toHaveLength(0);
    expect(get().history.future).toHaveLength(HISTORY_LIMIT);
  });

  it("caps the redo stack too", () => {
    for (let i = 0; i < 5; i++) place("crop", i, 0);
    for (let i = 0; i < 5; i++) get().undo();
    expect(get().history.future.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(get().history.future).toHaveLength(5);
  });

  it("drops undone-away objects from the selection", () => {
    const id = place("crop", 1, 1);
    get().setSelection([id]);
    get().undo();
    expect(get().selection).toEqual([]);
  });

  it("keeps a still-valid selection through undo", () => {
    const a = place("crop", 1, 1);
    place("crop", 5, 5);
    get().setSelection([a]);
    get().undo();
    expect(get().selection).toEqual([a]);
  });
});

describe("history belongs to the active layout", () => {
  it("resets when switching layout and when a new layout is created", () => {
    const first = get().activeLayoutId!;
    place("crop", 1, 1);
    const second = get().createLayout("second", 8, 8);
    expect(get().history).toEqual({ past: [], future: [] });
    place("crop", 2, 2);
    get().setActiveLayout(first);
    expect(get().history).toEqual({ past: [], future: [] });
    expect(get().layouts[second]?.objects).toHaveLength(1);
  });

  it("resets when the active layout is deleted but not when another one is", () => {
    const first = get().activeLayoutId!;
    const second = get().createLayout("second", 8, 8);
    place("crop", 1, 1);
    get().deleteLayout(first);
    expect(get().history.past).toHaveLength(1);
    get().deleteLayout(second);
    expect(get().history).toEqual({ past: [], future: [] });
  });

  it("ignores renames of layouts that are not active", () => {
    const first = get().activeLayoutId!;
    get().createLayout("second", 8, 8);
    get().renameLayout(first, "Other");
    expect(get().history.past).toHaveLength(0);
  });

  it("is cleared by cross-layout removals, which cannot be undone", () => {
    place("crop", 1, 1);
    expect(get().history.past).toHaveLength(1);
    get().removeObjectsByDef("builtin-crop");
    expect(get().history).toEqual({ past: [], future: [] });
  });

  it("clearHistory empties both stacks", () => {
    place("crop", 1, 1);
    get().undo();
    get().clearHistory();
    expect(get().history).toEqual({ past: [], future: [] });
  });
});
