import { describe, expect, it } from "vitest";
import { buildIsoModel } from "../lib/isoModel";
import { drawIsoLayout, isoExportSize, isoExportTile } from "../lib/renderIso";
import {
  drawLayout,
  exportSize,
  fitsExportLimit,
  renderLayoutToCanvas,
  type RenderOptions,
} from "../lib/renderToCanvas";
import { exportFileName } from "../lib/format";
import { LABEL_INK } from "../theme/contrast";
import { EXPORT_THEME as T } from "../theme/exportTheme";
import type { FarmLayout, PlacedObject } from "../types";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";
import { RecordingContext, asContext } from "./recordingContext";

const OPTIONS: RenderOptions = {
  cellSize: 32,
  showGrid: true,
  showEffects: true,
  showLabels: true,
  showCoordinates: true,
  background: "#fff6ee",
  padding: 16,
  projection: "iso",
};

const obj = (id: string, def: string, x: number, y: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({
  id, defId: `builtin-${def}`, x, y, rotation: 0, showEffect: true, ...extra,
});
const layoutOf = (objects: PlacedObject[], size = 17): FarmLayout => ({
  id: "l", name: "t", width: size, height: size, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

function draw(objects: PlacedObject[], o: Partial<RenderOptions> = {}, size = 17) {
  const ctx = new RecordingContext();
  drawIsoLayout(asContext(ctx), layoutOf(objects, size), defs, { ...OPTIONS, ...o });
  return ctx;
}

describe("isometric export size", () => {
  it("uses a tile 1.5 times the cell size and follows the scene geometry", () => {
    expect(isoExportTile(OPTIONS)).toBe(48);
    const { width, height } = isoExportSize(layoutOf([]), OPTIONS);
    expect(width).toBe(((17 + 17) * 48) / 2 + 32);
    expect(height).toBeGreaterThan(width / 2); // the diamond is 2:1, plus room above for icons
  });

  it("scales with the export size", () => {
    const small = isoExportSize(layoutOf([]), OPTIONS);
    const big = isoExportSize(layoutOf([]), { ...OPTIONS, cellSize: 128, padding: 64 });
    expect(big.width).toBeGreaterThan(small.width * 3);
  });

  it("is chosen by the projection option", () => {
    const layout = layoutOf([]);
    expect(exportSize(layout, OPTIONS)).toEqual(isoExportSize(layout, OPTIONS));
    expect(exportSize(layout, { ...OPTIONS, projection: "top" })).not.toEqual(isoExportSize(layout, OPTIONS));
    expect(exportSize(layout, { ...OPTIONS, projection: undefined })).toEqual(
      exportSize(layout, { ...OPTIONS, projection: "top" }),
    );
  });

  it("applies the browser pixel cap to the isometric size", () => {
    const big = layoutOf([], 64);
    expect(fitsExportLimit(big, OPTIONS)).toBe(true); // 1x
    expect(fitsExportLimit(big, { ...OPTIONS, cellSize: 64 })).toBe(false); // 2x is over the cap
  });
});

describe("drawIsoLayout layers", () => {
  const scene = [obj("a", "crop", 3, 3), obj("s", "scarecrow", 9, 9, { label: "North" })];

  it("paints the background, then the ground, then the grid, effects and objects", () => {
    const ctx = draw(scene);
    const bg = ctx.indexOf((c) => c.op === "fillRect" && c.fillStyle === "#fff6ee");
    const ground = ctx.indexOf((c) => c.op === "fill" && c.fillStyle === T.board);
    const grid = ctx.indexOf((c) => c.op === "stroke" && c.strokeStyle === T.gridLine);
    const tint = ctx.indexOf((c) => c.op === "fill" && c.globalAlpha === 0.3);
    const model = buildIsoModel(layoutOf(scene), defs, { tile: 48, padding: 16, showGrid: true, showLabels: true, showEffects: true, showCoordinates: true });
    const crop = model.objects.find((m) => m.obj.id === "a")!;
    const object = ctx.indexOf((c) => c.op === "fill" && c.fillStyle === crop.fill);
    expect([bg, ground, grid, tint, object].every((i) => i >= 0)).toBe(true);
    expect(bg).toBeLessThan(ground);
    expect(ground).toBeLessThan(grid);
    expect(grid).toBeLessThan(tint);
    expect(tint).toBeLessThan(object);
  });

  it("fills the ground as a four-cornered diamond in the board colour", () => {
    const ctx = draw([]);
    const i = ctx.indexOf((c) => c.op === "fill" && c.fillStyle === T.board);
    const path = ctx.calls.slice(0, i).filter((c) => c.op === "moveTo" || c.op === "lineTo");
    expect(path).toHaveLength(4);
  });

  it("leaves the background out when it is null", () => {
    expect(draw([], { background: null }).of("fillRect")).toHaveLength(0);
    expect(draw([]).of("fillRect")).toHaveLength(1);
  });

  it("draws 26 minor and 6 major grid lines on a 17x17 board, and none when the grid is off", () => {
    const ctx = draw([]);
    const minor = ctx.of("moveTo").filter((c) => c.strokeStyle === T.gridLine);
    const major = ctx.of("moveTo").filter((c) => c.strokeStyle === T.gridLineMajor);
    expect(minor).toHaveLength(26);
    expect(major).toHaveLength(6);
    const off = draw([], { showGrid: false });
    expect(off.of("moveTo").filter((c) => c.strokeStyle === T.gridLine)).toHaveLength(0);
  });

  it("numbers the edges, or not", () => {
    const numbers = (ctx: RecordingContext) => ctx.texts().filter((t) => /^\d+$/.test(t));
    expect(numbers(draw([]))).toHaveLength(34);
    expect(numbers(draw([], { showCoordinates: false }))).toEqual([]);
  });
});

describe("drawIsoLayout objects", () => {
  const model = (objects: PlacedObject[]) =>
    buildIsoModel(layoutOf(objects), defs, { tile: 48, padding: 16, showGrid: true, showLabels: true, showEffects: true, showCoordinates: true });

  it("paints each block's left, right and top faces in that order, in shades of its colour", () => {
    const m = model([obj("a", "crop", 3, 3)]).objects[0]!;
    const ctx = draw([obj("a", "crop", 3, 3)]);
    const order = [m.fillLeft, m.fillRight, m.fill].map((color) => ctx.indexOf((c) => c.op === "fill" && c.fillStyle === color));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1] as number);
    expect(order[1]).toBeLessThan(order[2] as number);
    expect(new Set([m.fillLeft, m.fillRight, m.fill]).size).toBe(3);
  });

  it("uses a colour override for the block", () => {
    const ctx = draw([obj("a", "crop", 3, 3, { colorOverride: "#123456" })]);
    expect(ctx.of("fill").some((c) => c.fillStyle === "#123456")).toBe(true);
  });

  it("draws nearer objects after the ones behind them", () => {
    const behind = obj("behind", "crop", 2, 2, { colorOverride: "#111111" });
    const front = obj("front", "crop", 8, 8, { colorOverride: "#222222" });
    const ctx = draw([front, behind]);
    const at = (color: string) => ctx.indexOf((c) => c.op === "fill" && c.fillStyle === color);
    expect(at("#111111")).toBeLessThan(at("#222222"));
  });

  it("stands the icon on the block with a shadow, and draws nothing for things without one", () => {
    const withIcon = draw([obj("a", "crop", 3, 3)]);
    expect(withIcon.texts()).toContain("🌱");
    expect(withIcon.of("ellipse")).toHaveLength(1);
    const path = draw([obj("p", "path", 3, 3)]);
    expect(path.of("ellipse")).toHaveLength(0);
    expect(path.texts().filter((t) => !/^\d+$/.test(t))).toEqual([]);
  });

  it("draws labels on a paper pill in ink, only when labels are on", () => {
    const labelled = [obj("c", "crop", 3, 3, { label: "Wheat" })];
    const ctx = draw(labelled);
    const text = ctx.of("fillText").find((c) => c.args[0] === "Wheat")!;
    expect(text.fillStyle).toBe(LABEL_INK);
    expect(ctx.of("fill").some((c) => c.fillStyle === T.paper)).toBe(true);
    expect(draw(labelled, { showLabels: false }).texts()).not.toContain("Wheat");
  });

  it("draws one tinted, dashed area per effect, clipped, and none when effects are off", () => {
    const ctx = draw([obj("s", "scarecrow", 9, 9)]);
    expect(ctx.of("setLineDash")).toHaveLength(1);
    expect(ctx.of("clip")).toHaveLength(1);
    expect(draw([obj("s", "scarecrow", 9, 9)], { showEffects: false }).of("setLineDash")).toHaveLength(0);
    expect(draw([obj("s", "scarecrow", 9, 9, { showEffect: false })]).of("setLineDash")).toHaveLength(0);
  });

  it("shows a count only where three or more areas stack", () => {
    const three = [obj("a", "sprinkler", 5, 5), obj("b", "sprinkler", 6, 5), obj("c", "sprinkler", 7, 5)];
    expect(draw(three).texts().some((t) => t.startsWith("×"))).toBe(true);
    expect(draw(three.slice(0, 2)).texts().some((t) => t.startsWith("×"))).toBe(false);
  });

  it("scales stroke widths up for larger exports so lines do not thin out", () => {
    const small = draw([], { cellSize: 32 }).of("stroke").find((c) => c.strokeStyle === T.boardEdge)!;
    const big = draw([], { cellSize: 128, padding: 64 }).of("stroke").find((c) => c.strokeStyle === T.boardEdge)!;
    expect(big.lineWidth).toBeGreaterThan(small.lineWidth * 3);
  });
});

describe("dispatch from the shared renderer", () => {
  it("drawLayout draws the isometric board for projection iso and the top board otherwise", () => {
    const iso = new RecordingContext();
    drawLayout(asContext(iso), layoutOf([obj("a", "crop", 3, 3)]), defs, OPTIONS);
    expect(iso.of("strokeRect")).toHaveLength(0); // the top view frames its board with strokeRect
    expect(iso.of("ellipse")).toHaveLength(1);

    const top = new RecordingContext();
    drawLayout(asContext(top), layoutOf([obj("a", "crop", 3, 3)]), defs, { ...OPTIONS, projection: "top" });
    expect(top.of("strokeRect").length).toBeGreaterThan(0);
    expect(top.of("ellipse")).toHaveLength(0);
  });

  it("renderLayoutToCanvas sizes the canvas for the isometric image", () => {
    const ctx = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    renderLayoutToCanvas(layoutOf([]), defs, OPTIONS, () => canvas);
    expect({ width: canvas.width, height: canvas.height }).toEqual(isoExportSize(layoutOf([]), OPTIONS));
  });
});

describe("export file names", () => {
  it("can mark the isometric view", () => {
    expect(exportFileName("Farm 1", 17, 17, "png")).toBe("Farm 1-17x17.png");
    expect(exportFileName("Farm 1", 17, 17, "png", "isometric")).toBe("Farm 1-17x17-isometric.png");
  });
});
