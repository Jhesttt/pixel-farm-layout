import { describe, expect, it } from "vitest";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";
import { duplicatedObjects, nudgedObjects, rotatedObject, rotateObjects } from "../lib/edit";
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

describe("rotatedObject", () => {
  it("turns 90 degrees clockwise in place when there is room", () => {
    const f = obj("f", "fence", 2, 2);
    expect(rotatedObject(layoutOf(8, 8, [f]), defs, f)).toMatchObject({ x: 2, y: 2, rotation: 90 });
  });

  it("cycles 90 -> 180 -> 270 -> 0", () => {
    let f = obj("f", "fence", 2, 2);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      f = rotatedObject(layoutOf(8, 8, [f]), defs, f)!;
      seen.push(f.rotation);
    }
    expect(seen).toEqual([90, 180, 270, 0]);
  });

  it("shifts back inside the grid when turning would stick out", () => {
    const f = obj("f", "fence", 0, 3); // 2x1 on the bottom row of a 4x4 grid
    expect(rotatedObject(layoutOf(4, 4, [f]), defs, f)).toMatchObject({ x: 0, y: 2, rotation: 90 });
  });

  it("returns null when it cannot fit even after shifting", () => {
    const f = obj("f", "fence", 0, 0);
    const blocker = obj("b", "crop", 0, 1);
    expect(rotatedObject(layoutOf(8, 8, [f, blocker]), defs, f)).toBeNull();
  });

  it("returns null for an unknown definition", () => {
    const o = { ...obj("x", "crop", 0, 0), defId: "gone" };
    expect(rotatedObject(layoutOf(8, 8, [o]), defs, o)).toBeNull();
  });
});

describe("rotateObjects", () => {
  it("rotates every listed object and reports the changed ones", () => {
    const a = obj("a", "fence", 0, 0);
    const b = obj("b", "fence", 4, 4);
    const changed = rotateObjects(layoutOf(8, 8, [a, b]), defs, ["a", "b"]);
    expect(changed.map((o) => [o.id, o.rotation])).toEqual([["a", 90], ["b", 90]]);
  });

  it("leaves objects that cannot turn and still turns the others", () => {
    const stuck = obj("s", "fence", 0, 0);
    const blocker = obj("k", "crop", 0, 1);
    const free = obj("f", "fence", 4, 4);
    const changed = rotateObjects(layoutOf(8, 8, [stuck, blocker, free]), defs, ["s", "f"]);
    expect(changed.map((o) => o.id)).toEqual(["f"]);
  });

  it("lets a later object see an earlier one's new position", () => {
    // a turns from (0,0)-(1,0) to (0,0)-(0,1), which takes (0,1) away from b's rotation
    const a = obj("a", "fence", 0, 0);
    const b = obj("b", "fence", 0, 2); // after turning it would cover (0,2),(0,3): free; stays valid
    const changed = rotateObjects(layoutOf(8, 8, [a, b]), defs, ["a", "b"]);
    expect(changed).toHaveLength(2);
  });

  it("ignores unknown ids", () => {
    expect(rotateObjects(layoutOf(8, 8, []), defs, ["nope"])).toEqual([]);
  });
});

describe("nudgedObjects", () => {
  it("shifts a single object by one cell", () => {
    const c = obj("c", "crop", 3, 3);
    expect(nudgedObjects(layoutOf(8, 8, [c]), defs, ["c"], 1, 0)).toEqual([{ ...c, x: 4 }]);
  });

  it("refuses to leave the grid", () => {
    const c = obj("c", "crop", 0, 0);
    expect(nudgedObjects(layoutOf(8, 8, [c]), defs, ["c"], -1, 0)).toBeNull();
    expect(nudgedObjects(layoutOf(8, 8, [c]), defs, ["c"], 0, -1)).toBeNull();
  });

  it("refuses to hit an object outside the group", () => {
    const a = obj("a", "crop", 0, 0);
    const b = obj("b", "crop", 1, 0);
    expect(nudgedObjects(layoutOf(8, 8, [a, b]), defs, ["a"], 1, 0)).toBeNull();
  });

  it("moves a group together, letting members pass through each other's old cells", () => {
    const a = obj("a", "crop", 0, 0);
    const b = obj("b", "crop", 1, 0);
    const moved = nudgedObjects(layoutOf(8, 8, [a, b]), defs, ["a", "b"], 1, 0)!;
    expect(moved.map((o) => o.x)).toEqual([1, 2]);
  });

  it("moves nothing if one member of the group is blocked", () => {
    const a = obj("a", "crop", 6, 0);
    const b = obj("b", "crop", 7, 0);
    expect(nudgedObjects(layoutOf(8, 8, [a, b]), defs, ["a", "b"], 1, 0)).toBeNull();
  });

  it("returns null for an empty or unknown selection", () => {
    expect(nudgedObjects(layoutOf(8, 8, []), defs, ["x"], 1, 0)).toBeNull();
  });
});

describe("duplicatedObjects", () => {
  let n = 0;
  const newId = () => `copy-${n++}`;

  it("offsets a single copy one cell down-right when free", () => {
    n = 0;
    const c = obj("c", "crop", 2, 2);
    const copies = duplicatedObjects(layoutOf(8, 8, [c]), defs, ["c"], newId)!;
    expect(copies).toEqual([{ ...c, id: "copy-0", x: 3, y: 3 }]);
  });

  it("keeps label, colour and rotation", () => {
    const f = { ...obj("f", "fence", 1, 1, 90), label: "Gate", colorOverride: "#aabbcc" };
    const [copy] = duplicatedObjects(layoutOf(8, 8, [f]), defs, ["f"], newId)!;
    expect(copy).toMatchObject({ label: "Gate", colorOverride: "#aabbcc", rotation: 90 });
  });

  it("searches outward until the whole copy fits", () => {
    const barn = obj("b", "barn", 0, 0);
    const [copy] = duplicatedObjects(layoutOf(12, 12, [barn]), defs, ["b"], newId)!;
    expect(copy).toMatchObject({ x: 4, y: 4 }); // the barn is 4 wide: the nearest diagonal that clears it
  });

  it("copies a group as a unit", () => {
    n = 0;
    const a = obj("a", "crop", 0, 0);
    const b = obj("b", "crop", 1, 0);
    const copies = duplicatedObjects(layoutOf(8, 8, [a, b]), defs, ["a", "b"], newId)!;
    expect(copies.map((c) => [c.x, c.y])).toEqual([[1, 1], [2, 1]]);
  });

  it("returns null when nothing fits", () => {
    const barn = obj("b", "barn", 0, 0);
    expect(duplicatedObjects(layoutOf(4, 4, [barn]), defs, ["b"], newId)).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(duplicatedObjects(layoutOf(8, 8, []), defs, [], newId)).toBeNull();
  });

  it("never overlaps existing objects", () => {
    const c = obj("c", "crop", 2, 2);
    const blockers = [obj("x", "crop", 3, 3), obj("y", "crop", 3, 2), obj("z", "crop", 2, 3)];
    const [copy] = duplicatedObjects(layoutOf(8, 8, [c, ...blockers]), defs, ["c"], newId)!;
    expect([copy!.x, copy!.y]).not.toEqual([3, 3]);
    expect(copy!.x === 2 && copy!.y === 2).toBe(false);
  });
});
