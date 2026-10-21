/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURE_DEFINITIONS as defs } from "./fixtures";
import {
  MAX_EXPORT_PIXELS,
  canvasToPngBlob,
  drawLayout,
  exportSize,
  fitsExportLimit,
  renderLayoutToCanvas,
  type DrawContext,
  type RenderOptions,
} from "../lib/renderToCanvas";
import { LABEL_INK, LABEL_PAPER } from "../theme/contrast";
import { EXPORT_THEME, EXPORT_THEME_TOKENS } from "../theme/exportTheme";
import { parseTokens } from "../theme/contrast";
import type { FarmLayout, PlacedObject } from "../types";

interface Call {
  op: string;
  args: unknown[];
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
}

/** A 2D context that records every call with the style in force at that moment. */
class RecordingContext {
  calls: Call[] = [];
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  globalAlpha = 1;
  font = "10px sans-serif";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";

  private record(op: string, args: unknown[]) {
    this.calls.push({
      op,
      args,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      font: this.font,
    });
  }
  save = () => this.record("save", []);
  restore = () => this.record("restore", []);
  beginPath = () => this.record("beginPath", []);
  closePath = () => this.record("closePath", []);
  moveTo = (...a: unknown[]) => this.record("moveTo", a);
  lineTo = (...a: unknown[]) => this.record("lineTo", a);
  arcTo = (...a: unknown[]) => this.record("arcTo", a);
  arc = (...a: unknown[]) => this.record("arc", a);
  rect = (...a: unknown[]) => this.record("rect", a);
  clip = () => this.record("clip", []);
  fill = () => this.record("fill", []);
  stroke = () => this.record("stroke", []);
  fillRect = (...a: unknown[]) => this.record("fillRect", a);
  strokeRect = (...a: unknown[]) => this.record("strokeRect", a);
  fillText = (...a: unknown[]) => this.record("fillText", a);
  setLineDash = (...a: unknown[]) => this.record("setLineDash", a);
  measureText = (text: string) => {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * px * 0.6 } as TextMetrics;
  };

  of(op: string) {
    return this.calls.filter((c) => c.op === op);
  }
  texts() {
    return this.of("fillText").map((c) => String(c.args[0]));
  }
  indexOf(predicate: (c: Call) => boolean) {
    return this.calls.findIndex(predicate);
  }
}

const OPTIONS: RenderOptions = {
  cellSize: 32,
  showGrid: true,
  showEffects: true,
  showLabels: true,
  showCoordinates: false,
  background: "#fff6ee",
  padding: 16,
};

const obj = (
  id: string,
  def: string,
  x: number,
  y: number,
  rotation: PlacedObject["rotation"] = 0,
  extra: Partial<PlacedObject> = {},
): PlacedObject => ({ id, defId: `builtin-${def}`, x, y, rotation, showEffect: true, ...extra });

const layoutOf = (objects: PlacedObject[], size = 17): FarmLayout => ({
  id: "l", name: "t", width: size, height: size, objects, createdAt: 0, updatedAt: 0, schemaVersion: 1,
});

function draw(layout: FarmLayout, options: Partial<RenderOptions> = {}) {
  const ctx = new RecordingContext();
  drawLayout(ctx as unknown as DrawContext, layout, defs, { ...OPTIONS, ...options });
  return ctx;
}

describe("exportSize and limits", () => {
  it("adds padding on both sides to the grid size", () => {
    expect(exportSize(layoutOf([]), OPTIONS)).toEqual({ width: 17 * 32 + 32, height: 17 * 32 + 32 });
  });

  it("adds a ruler band when coordinates are shown", () => {
    const { width } = exportSize(layoutOf([]), { ...OPTIONS, showCoordinates: true });
    expect(width).toBe(17 * 32 + 32 + Math.round(32 * 0.7));
  });

  it("accepts ordinary sizes and rejects ones past the pixel cap", () => {
    expect(fitsExportLimit(layoutOf([]), OPTIONS)).toBe(true);
    expect(fitsExportLimit(layoutOf([], 64), { ...OPTIONS, cellSize: 32 })).toBe(true);
    expect(fitsExportLimit(layoutOf([], 64), { ...OPTIONS, cellSize: 128 })).toBe(false);
    const { width, height } = exportSize(layoutOf([], 64), { ...OPTIONS, cellSize: 64 });
    expect(width * height <= MAX_EXPORT_PIXELS).toBe(fitsExportLimit(layoutOf([], 64), { ...OPTIONS, cellSize: 64 }));
  });
});

describe("drawLayout order and layers", () => {
  const scarecrowLayout = layoutOf([obj("s", "scarecrow", 8, 8), obj("c", "crop", 1, 1)]);

  it("paints background, board, effects, grid, frame, then objects", () => {
    const ctx = draw(scarecrowLayout);
    const background = ctx.indexOf((c) => c.op === "fillRect" && c.fillStyle === "#fff6ee");
    const board = ctx.indexOf((c) => c.op === "fillRect" && c.fillStyle === EXPORT_THEME.board);
    const effect = ctx.indexOf((c) => c.op === "fillRect" && c.globalAlpha === 0.3);
    const grid = ctx.indexOf((c) => c.op === "stroke" && c.strokeStyle === EXPORT_THEME.gridLine);
    const frame = ctx.indexOf((c) => c.op === "strokeRect" && c.strokeStyle === EXPORT_THEME.boardEdge);
    const object = ctx.indexOf((c) => c.op === "fill" && c.fillStyle === defs.find((d) => d.id === "builtin-crop")!.color);
    expect([background, board, effect, grid, frame, object].every((i) => i >= 0)).toBe(true);
    expect(background).toBeLessThan(board);
    expect(board).toBeLessThan(effect);
    expect(effect).toBeLessThan(grid);
    expect(grid).toBeLessThan(frame);
    expect(frame).toBeLessThan(object);
  });

  it("fills the board exactly over the grid area", () => {
    const ctx = draw(layoutOf([]));
    const board = ctx.of("fillRect").find((c) => c.fillStyle === EXPORT_THEME.board)!;
    expect(board.args).toEqual([16, 16, 17 * 32, 17 * 32]);
  });

  it("leaves the background out when it is null (transparent)", () => {
    const ctx = draw(layoutOf([]), { background: null });
    expect(ctx.of("fillRect")).toHaveLength(1);
    expect(ctx.of("fillRect")[0]?.fillStyle).toBe(EXPORT_THEME.board);
  });

  it("draws grid lines only when asked: 13 minor and 3 major per axis on 17x17", () => {
    const withGrid = draw(layoutOf([]));
    const minor = withGrid.of("moveTo").filter((c) => c.strokeStyle === EXPORT_THEME.gridLine);
    const major = withGrid.of("moveTo").filter((c) => c.strokeStyle === EXPORT_THEME.gridLineMajor);
    expect(minor).toHaveLength(26);
    expect(major).toHaveLength(6);
    const without = draw(layoutOf([]), { showGrid: false });
    expect(without.of("moveTo")).toHaveLength(0);
  });
});

describe("effects", () => {
  it("tints the full 7x7 area of a scarecrow", () => {
    const ctx = draw(layoutOf([obj("s", "scarecrow", 8, 8)]));
    const tint = ctx.of("fillRect").find((c) => c.globalAlpha === 0.3)!;
    expect(tint.args).toEqual([16 + 5 * 32, 16 + 5 * 32, 7 * 32, 7 * 32]);
  });

  it("clips the tint at the grid edge", () => {
    const ctx = draw(layoutOf([obj("s", "scarecrow", 0, 0)]));
    const tint = ctx.of("fillRect").find((c) => c.globalAlpha === 0.3)!;
    expect(tint.args).toEqual([16, 16, 4 * 32, 4 * 32]);
  });

  it("uses the effect colour and a dashed outline", () => {
    const ctx = draw(layoutOf([obj("s", "scarecrow", 8, 8)]));
    const tint = ctx.of("fillRect").find((c) => c.globalAlpha === 0.3)!;
    expect(tint.fillStyle).toBe(defs.find((d) => d.id === "builtin-scarecrow")!.effect!.color);
    expect(ctx.of("setLineDash")).toHaveLength(1);
    expect(ctx.of("strokeRect").some((c) => c.lineWidth === 2 && c.strokeStyle !== EXPORT_THEME.boardEdge)).toBe(true);
  });

  it("is skipped by the global toggle and by a per-object toggle", () => {
    expect(draw(layoutOf([obj("s", "scarecrow", 8, 8)]), { showEffects: false }).of("setLineDash")).toHaveLength(0);
    const off = layoutOf([obj("s", "scarecrow", 8, 8, 0, { showEffect: false })]);
    expect(draw(off).of("setLineDash")).toHaveLength(0);
  });

  it("does not move a centred effect when its object is rotated", () => {
    // A centred 3x3 sprinkler covers the same cells at every rotation.
    const a = draw(layoutOf([obj("p", "sprinkler", 5, 5, 0)])).of("fillRect").find((c) => c.globalAlpha === 0.3)!;
    const b = draw(layoutOf([obj("p", "sprinkler", 5, 5, 90)])).of("fillRect").find((c) => c.globalAlpha === 0.3)!;
    expect(a.args).toEqual(b.args);
  });

  it("shows a count only where three or more areas stack", () => {
    const two = draw(layoutOf([obj("a", "scarecrow", 6, 8), obj("b", "scarecrow", 7, 8)]));
    expect(two.texts().filter((t) => t.startsWith("×"))).toEqual([]);
    const three = draw(layoutOf([obj("a", "scarecrow", 6, 8), obj("b", "scarecrow", 7, 8), obj("c", "scarecrow", 8, 8)]));
    expect(three.texts().filter((t) => t.startsWith("×"))).toContain("×3");
  });

  it("leaves counts out when cells are too small to hold them", () => {
    const layout = layoutOf([obj("a", "scarecrow", 6, 8), obj("b", "scarecrow", 7, 8), obj("c", "scarecrow", 8, 8)]);
    expect(draw(layout, { cellSize: 16 }).texts().filter((t) => t.startsWith("×"))).toEqual([]);
  });
});

describe("objects", () => {
  /** The first arcTo of the rounded-rect path that was filled with this colour. */
  const firstArcTo = (ctx: RecordingContext, fillStyle: string) => {
    const fillIdx = ctx.indexOf((c) => c.op === "fill" && c.fillStyle === fillStyle);
    let start = fillIdx;
    while (start > 0 && ctx.calls[start]!.op !== "beginPath") start--;
    const arc = ctx.calls.slice(start, fillIdx).find((c) => c.op === "arcTo");
    if (!arc) throw new Error("no path before fill");
    return arc.args as number[];
  };

  it("places a footprint at its cell with the rotated size", () => {
    const fence = defs.find((d) => d.id === "builtin-fence")!;
    const ctx = draw(layoutOf([obj("f", "fence", 2, 3, 90)]), { showLabels: false });
    // first arcTo is (x + w, y, x + w, y + h, r)
    const [right, top, , bottom] = firstArcTo(ctx, fence.color) as [number, number, number, number];
    expect(right).toBe(16 + 2 * 32 + 1 * 32); // rotated: 1 cell wide
    expect(top).toBe(16 + 3 * 32);
    expect(bottom - top).toBe(2 * 32); // and 2 cells tall
  });

  it("uses the colour override instead of the default", () => {
    const ctx = draw(layoutOf([obj("c", "crop", 1, 1, 0, { colorOverride: "#112233" })]));
    expect(ctx.of("fill").some((c) => c.fillStyle === "#112233")).toBe(true);
  });

  it("draws the icon, and skips it when the footprint is too small", () => {
    const crop = layoutOf([obj("c", "crop", 1, 1)]);
    expect(draw(crop).texts()).toContain("🌱");
    expect(draw(crop, { cellSize: 16 }).texts()).not.toContain("🌱");
  });

  it("draws labels in a readable colour, and not when labels are off", () => {
    const labelled = layoutOf([obj("b", "barn", 1, 1, 0, { label: "Main" }), obj("c", "crop", 8, 8, 0, { label: "A" })]);
    const ctx = draw(labelled);
    const main = ctx.of("fillText").find((c) => c.args[0] === "Main")!;
    expect(main.fillStyle).toBe(LABEL_PAPER); // on the dark rose barn
    const crop = ctx.of("fillText").find((c) => c.args[0] === "A")!;
    expect(crop.fillStyle).toBe(LABEL_INK); // on light sage
    expect(draw(labelled, { showLabels: false }).texts()).not.toContain("Main");
  });

  it("shortens a label that does not fit its footprint", () => {
    const ctx = draw(layoutOf([obj("c", "crop", 3, 3, 0, { label: "A very long label indeed" })]), { showLabels: true });
    const text = ctx.texts().find((t) => t.endsWith("…"))!;
    expect(text).toBeDefined();
    const px = Math.max(11, Math.round(32 * 0.3));
    expect(text.length * px * 0.6).toBeLessThanOrEqual(32 - 8);
  });

  it("skips objects whose definition is unknown", () => {
    const ghost = { ...obj("x", "crop", 1, 1), defId: "gone" };
    const ctx = draw(layoutOf([ghost]));
    expect(ctx.of("fill")).toHaveLength(0);
  });
});

describe("coordinates", () => {
  const numeric = (ctx: RecordingContext) => ctx.texts().filter((t) => /^\d+$/.test(t));

  it("labels every cell on both axes at comfortable sizes", () => {
    const ctx = draw(layoutOf([]), { showCoordinates: true });
    expect(numeric(ctx)).toHaveLength(34);
    expect(numeric(ctx)).toContain("16");
  });

  it("labels only every fifth cell when cells are small", () => {
    const ctx = draw(layoutOf([]), { showCoordinates: true, cellSize: 16 });
    expect(numeric(ctx)).toEqual(["0", "5", "10", "15", "0", "5", "10", "15"]);
  });

  it("draws none when off, and moves the board to make room when on", () => {
    expect(numeric(draw(layoutOf([])))).toEqual([]);
    const on = draw(layoutOf([]), { showCoordinates: true });
    const board = on.of("fillRect").find((c) => c.fillStyle === EXPORT_THEME.board)!;
    const ruler = Math.round(32 * 0.7);
    expect(board.args[0]).toBe(16 + ruler);
  });
});

describe("renderLayoutToCanvas and canvasToPngBlob", () => {
  it("sizes a canvas and draws into it", () => {
    const ctx = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const result = renderLayoutToCanvas(layoutOf([]), defs, OPTIONS, () => canvas);
    expect(result).toBe(canvas);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(576);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it("throws a clear error when 2D drawing is unavailable", () => {
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => renderLayoutToCanvas(layoutOf([]), defs, OPTIONS, () => canvas)).toThrow(/Canvas 2D/);
  });

  it("resolves a PNG blob, and rejects when the browser returns none", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const ok = { toBlob: (cb: BlobCallback, type?: string) => cb(type === "image/png" ? blob : null) } as unknown as HTMLCanvasElement;
    await expect(canvasToPngBlob(ok)).resolves.toBe(blob);
    const fail = { toBlob: (cb: BlobCallback) => cb(null) } as unknown as HTMLCanvasElement;
    await expect(canvasToPngBlob(fail)).rejects.toThrow(/smaller size/);
  });
});

describe("export theme", () => {
  it("mirrors the CSS tokens exactly", () => {
    const tokens = parseTokens(readFileSync(new URL("../theme.css", import.meta.url), "utf8"));
    for (const [token, key] of Object.entries(EXPORT_THEME_TOKENS)) {
      expect(EXPORT_THEME[key], token).toBe(tokens[token]);
    }
  });

  it("derives its ink translucencies from --color-ink-deep", () => {
    expect(EXPORT_THEME.objectEdge).toBe("rgba(42, 22, 22, 0.7)");
    expect(EXPORT_THEME.inkDeep).toBe("#2a1616");
  });
});
