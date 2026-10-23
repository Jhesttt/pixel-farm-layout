import { describe, expect, it } from "vitest";
import { isoProject } from "../lib/iso";
import { ISO_FLAT_LIFT_RATIO, buildIsoModel, isoBlockFor, type IsoModelOptions } from "../lib/isoModel";
import { LABEL_INK } from "../theme/contrast";
import type { FarmLayout, PlacedObject } from "../types";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";

const OPTIONS: IsoModelOptions = {
  tile: 48,
  padding: 16,
  showGrid: true,
  showLabels: true,
  showEffects: true,
  showCoordinates: true,
};

const obj = (id: string, def: string, x: number, y: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({
  id, defId: `builtin-${def}`, x, y, rotation: 0, showEffect: true, ...extra,
});
const layoutOf = (objects: PlacedObject[], size = 17): FarmLayout => ({
  id: "l", name: "t", width: size, height: size, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1,
});
const build = (objects: PlacedObject[], o: Partial<IsoModelOptions> = {}, size = 17) =>
  buildIsoModel(layoutOf(objects, size), defs, { ...OPTIONS, ...o });

describe("buildIsoModel scene", () => {
  it("sizes the scene from the grid and tile, with the ground as one diamond", () => {
    const m = build([]);
    expect(m.width).toBe((17 + 17) * 24 + 32);
    expect(m.ground.top).toEqual(isoProject(m.view, 0, 0));
    expect(m.ground.bottom).toEqual(isoProject(m.view, 17, 17));
  });

  it("grows with the tile size", () => {
    expect(build([], { tile: 96 }).width).toBeGreaterThan(build([], { tile: 48 }).width);
  });
});

describe("grid lines and rulers", () => {
  it("has 13 minor and 3 major lines per axis on a 17x17 board, and none when the grid is off", () => {
    const m = build([]);
    expect(m.gridMinor).toHaveLength(26);
    expect(m.gridMajor).toHaveLength(6);
    const off = build([], { showGrid: false });
    expect(off.gridMinor).toHaveLength(0);
    expect(off.gridMajor).toHaveLength(0);
  });

  it("numbers every cell on both edges at a comfortable size, every fifth when small", () => {
    expect(build([]).rulers).toHaveLength(34);
    const small = build([], { tile: 24 });
    expect(small.rulers.map((r) => r.text)).toEqual(["0", "5", "10", "15", "0", "5", "10", "15"]);
  });

  it("leaves rulers out when asked, and when the tile is too small to read", () => {
    expect(build([], { showCoordinates: false }).rulers).toEqual([]);
    expect(build([], { tile: 16 }).rulers).toEqual([]);
  });

  it("places the x numbers above the upper-right edge and the y numbers above the upper-left", () => {
    const m = build([]);
    const x0 = m.rulers.find((r) => r.text === "0")!; // first label is the x axis
    const top = isoProject(m.view, 0.5, 0);
    expect(x0.x).toBeGreaterThan(top.x);
    expect(x0.y).toBeLessThan(top.y);
    const yLabels = m.rulers.slice(17);
    expect(yLabels[0]!.x).toBeLessThan(isoProject(m.view, 0, 0.5).x);
  });
});

describe("objects", () => {
  it("lists objects back to front", () => {
    const m = build([obj("front", "crop", 5, 5), obj("barn", "barn", 0, 0), obj("back", "crop", 4, 0)]);
    const ids = m.objects.map((o) => o.obj.id);
    expect(ids.indexOf("barn")).toBeLessThan(ids.indexOf("back")); // the barn is behind the crop to its right
    expect(ids.indexOf("back")).toBeLessThan(ids.indexOf("front"));
  });

  it("skips objects whose definition is unknown", () => {
    const m = build([{ ...obj("x", "crop", 1, 1), defId: "gone" }, obj("ok", "crop", 3, 3)]);
    expect(m.objects.map((o) => o.obj.id)).toEqual(["ok"]);
  });

  it("uses the colour override, with darker side faces", () => {
    const [o] = build([obj("c", "crop", 1, 1, { colorOverride: "#aabbcc" })]).objects;
    expect(o?.fill).toBe("#aabbcc");
    expect(o?.fillLeft).not.toBe(o?.fillRight);
    expect(o?.fillLeft).not.toBe("#aabbcc");
  });

  it("sizes the block from the rotated footprint", () => {
    const flat = build([obj("f", "fence", 2, 2)]).objects[0]!; // 2 wide, 1 deep
    const turned = build([obj("f", "fence", 2, 2, { rotation: 90 })]).objects[0]!; // 1 wide, 2 deep
    const view = build([]).view;
    expect(flat.block.base.right).toEqual(isoProject(view, 4, 2));
    expect(flat.block.base.bottom).toEqual(isoProject(view, 4, 3));
    expect(turned.block.base.right).toEqual(isoProject(view, 3, 2));
    expect(turned.block.base.bottom).toEqual(isoProject(view, 3, 4));
  });

  it("stands icon-bearing things as slabs with a billboard, and lays path-like things flat", () => {
    const crop = build([obj("c", "crop", 1, 1)]).objects[0]!;
    const path = build([obj("p", "path", 3, 3)]).objects[0]!;
    expect(crop.billboard).not.toBeNull();
    expect(path.billboard).toBeNull();
    expect(path.block.lift).toBeLessThan(crop.block.lift);
    expect(path.block.lift).toBeCloseTo(48 * ISO_FLAT_LIFT_RATIO, 5);
  });

  it("builds a six-point silhouette", () => {
    expect(build([obj("c", "crop", 1, 1)]).objects[0]!.silhouette).toHaveLength(6);
  });

  it("matches isoBlockFor for the same footprint", () => {
    const m = build([obj("s", "scarecrow", 4, 6)]);
    const direct = isoBlockFor(m.view, defs.find((d) => d.id === "builtin-scarecrow")!, 4, 6, 1, 1);
    expect(m.objects[0]!.block).toEqual(direct);
  });
});

describe("labels", () => {
  it("adds a pill above the icon, in ink, only when labels are on", () => {
    const withLabel = [obj("c", "crop", 1, 1, { label: "North" })];
    const on = build(withLabel).objects[0]!;
    expect(on.label?.text).toBe("North");
    expect(on.labelColor).toBe(LABEL_INK);
    expect(on.label!.rect.y + on.label!.rect.height).toBeLessThanOrEqual(on.billboard!.rect.y + 4);
    expect(build(withLabel, { showLabels: false }).objects[0]!.label).toBeNull();
  });

  it("widens the pill with the text and centres it on the object", () => {
    const short = build([obj("a", "crop", 1, 1, { label: "A" })]).objects[0]!;
    const long = build([obj("a", "crop", 1, 1, { label: "A much longer label" })]).objects[0]!;
    expect(long.label!.rect.width).toBeGreaterThan(short.label!.rect.width);
    expect(long.label!.textX).toBe(short.label!.textX);
  });

  it("puts the pill on the top face for an object without an icon", () => {
    const o = build([obj("p", "path", 3, 3, { label: "Road" })]).objects[0]!;
    expect(o.label!.textY).toBeGreaterThan(o.block.top.top.y);
    expect(o.label!.textY).toBeLessThan(o.block.top.bottom.y);
  });
});

describe("effects and badges", () => {
  it("makes a ground diamond per visible effect, clipped to the grid", () => {
    const m = build([obj("s", "scarecrow", 0, 0), obj("c", "crop", 9, 9)]);
    expect(m.effects).toHaveLength(1);
    expect(m.effects[0]!.diamond.top).toEqual(isoProject(m.view, 0, 0));
    expect(m.effects[0]!.diamond.bottom).toEqual(isoProject(m.view, 4, 4)); // a 7x7 reach clipped to 4x4
  });

  it("skips effects when switched off, for hidden objects, and adds the preview", () => {
    const s = [obj("s", "scarecrow", 8, 8)];
    expect(build(s, { showEffects: false }).effects).toEqual([]);
    expect(build(s, { hiddenObjectId: "s" }).effects).toEqual([]);
    const preview = build([], { effectPreview: { defId: "builtin-sprinkler", x: 5, y: 5, rotation: 0 } }).effects;
    expect(preview).toHaveLength(1);
    expect(preview[0]!.preview).toBe(true);
  });

  it("keeps the edge colour readable and gives each kind a stable texture", () => {
    const e = build([obj("s", "scarecrow", 8, 8)]).effects[0]!;
    expect(e.edge).toMatch(/^#[0-9a-f]{6}$/);
    expect(e.patternKind).toBe(build([obj("t", "scarecrow", 3, 3)]).effects[0]!.patternKind);
  });

  it("adds count badges only where three areas stack, and only at readable sizes", () => {
    const three = [obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5), obj("c", "sprinkler", 7, 5)];
    const m = build(three);
    expect(m.badges.length).toBeGreaterThan(0);
    expect(m.badges.every((b) => b.n >= 3 && b.text === `×${b.n}`)).toBe(true);
    expect(build(three, { tile: 16 }).badges).toEqual([]);
    expect(build([obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5)]).badges).toEqual([]);
  });
});
