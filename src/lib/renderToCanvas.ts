import { EFFECT_FILL_ALPHA, MIN_STACK_FOR_COUNT, effectPatternIndex } from "./effectStyle";
import { drawIsoLayout, isoExportSize } from "./renderIso";
import { getCellBounds, getEffectCells, getEffectCoverage, getFootprintSize } from "./grid";
import { EXPORT_EMOJI_FONT, EXPORT_FONT, EXPORT_THEME as T } from "../theme/exportTheme";
import { effectEdgeColor, labelColorFor } from "../theme/contrast";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

export interface RenderOptions {
  /** Pixels per cell, e.g. 32 gives a 17x17 grid 544px wide. The UI offers 1x / 2x / 4x of a base. */
  cellSize: number;
  showGrid: boolean;
  showEffects: boolean;
  showLabels: boolean;
  showCoordinates: boolean;
  /** CSS colour for the page behind the board, or null to leave it transparent. */
  background: string | null;
  /** Space around the board, in pixels. */
  padding: number;
  /** How the board is drawn. Defaults to "top"; "iso" gives the isometric view (a larger tile per cell). */
  projection?: "top" | "iso";
}

/** The part of CanvasRenderingContext2D the renderer uses, so it can be driven by a test double. */
export type DrawContext = Pick<
  CanvasRenderingContext2D,
  | "save" | "restore" | "beginPath" | "closePath" | "moveTo" | "lineTo" | "arcTo" | "arc" | "ellipse" | "rect"
  | "clip" | "fill" | "stroke" | "fillRect" | "strokeRect" | "fillText" | "measureText" | "setLineDash"
  | "fillStyle" | "strokeStyle" | "lineWidth" | "lineJoin" | "globalAlpha" | "font" | "textAlign" | "textBaseline"
>;

/** Largest export, in pixels: what every mainstream browser can allocate (16.7M is Safari's cap). */
export const MAX_EXPORT_PIXELS = 16_000_000;

const MIN_PX_FOR_ICON = 20;
const COUNT_BADGE_MIN_CELL = 24;

function rulerSize(o: RenderOptions): number {
  return o.showCoordinates ? Math.max(16, Math.round(o.cellSize * 0.7)) : 0;
}

/** Output size in pixels for a layout under these options. */
export function exportSize(layout: FarmLayout, o: RenderOptions): { width: number; height: number } {
  if (o.projection === "iso") return isoExportSize(layout, o);
  const ruler = rulerSize(o);
  return {
    width: 2 * o.padding + ruler + layout.width * o.cellSize,
    height: 2 * o.padding + ruler + layout.height * o.cellSize,
  };
}

export function fitsExportLimit(layout: FarmLayout, o: RenderOptions): boolean {
  const { width, height } = exportSize(layout, o);
  return width * height <= MAX_EXPORT_PIXELS;
}

function roundedRect(ctx: DrawContext, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** `text`, shortened with an ellipsis until it fits `maxWidth` at the context's current font. */
function fitText(ctx: DrawContext, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

function drawEffects(
  ctx: DrawContext,
  layout: FarmLayout,
  defsById: Map<string, ObjectDefinition>,
  defs: ObjectDefinition[],
  o: RenderOptions,
  originX: number,
  originY: number,
  lw: number,
): void {
  const s = o.cellSize;
  for (const obj of layout.objects) {
    const def = defsById.get(obj.defId);
    if (!def?.effect || !obj.showEffect) continue;
    const b = getCellBounds(getEffectCells(obj, def, layout));
    if (!b) continue;

    const x = originX + b.x * s;
    const y = originY + b.y * s;
    const w = b.width * s;
    const h = b.height * s;
    const edge = effectEdgeColor(def.effect.color);

    ctx.save();
    // Tint: translucent, so overlapping areas darken each other.
    ctx.globalAlpha = EFFECT_FILL_ALPHA;
    ctx.fillStyle = def.effect.color;
    ctx.fillRect(x, y, w, h);

    // Texture, clipped to the area.
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = edge;
    ctx.fillStyle = edge;
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const step = Math.max(6, Math.round(s / 4));
    const kind = effectPatternIndex(def.id);
    ctx.beginPath();
    if (kind === 0) {
      for (let k = -h; k < w; k += step) {
        ctx.moveTo(x + k, y + h);
        ctx.lineTo(x + k + h, y);
      }
      ctx.stroke();
    } else if (kind === 1) {
      for (let k = -h; k < w; k += step) {
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + h, y + h);
      }
      ctx.stroke();
    } else {
      for (let px = step / 2; px < w; px += step) {
        for (let py = step / 2; py < h; py += step) {
          ctx.beginPath();
          ctx.arc(x + px, y + py, lw * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Dashed outline, inside the area.
    ctx.save();
    ctx.strokeStyle = edge;
    ctx.lineWidth = lw * 2;
    ctx.setLineDash([Math.max(4, Math.round(s / 6)), Math.max(3, Math.round(s / 10))]);
    ctx.strokeRect(x + lw, y + lw, w - 2 * lw, h - 2 * lw);
    ctx.restore();
  }

  // Counts where three or more areas stack.
  if (s < COUNT_BADGE_MIN_CELL) return;
  const coverage = getEffectCoverage(layout, defs);
  const fontPx = Math.max(11, Math.round(s * 0.28));
  for (const [key, n] of coverage) {
    if (n < MIN_STACK_FOR_COUNT) continue;
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    const text = `×${n}`;
    ctx.save();
    ctx.font = `700 ${fontPx}px ${EXPORT_FONT}`;
    const textW = ctx.measureText(text).width;
    const padX = Math.round(fontPx * 0.35);
    const badgeW = textW + 2 * padX;
    const badgeH = fontPx + 4;
    const bx = originX + (cx + 1) * s - badgeW - 2;
    const by = originY + cy * s + 2;
    roundedRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = T.paper;
    ctx.fill();
    ctx.strokeStyle = T.badgeEdge;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.fillStyle = T.inkDeep;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + badgeW / 2, by + badgeH / 2 + 1);
    ctx.restore();
  }
}

function drawGrid(ctx: DrawContext, layout: FarmLayout, o: RenderOptions, ox: number, oy: number, lw: number) {
  const s = o.cellSize;
  const gw = layout.width * s;
  const gh = layout.height * s;
  const line = (indices: number[], axis: "x" | "y") => {
    ctx.beginPath();
    for (const i of indices) {
      const p = i * s + lw / 2;
      if (axis === "x") {
        ctx.moveTo(ox + p, oy);
        ctx.lineTo(ox + p, oy + gh);
      } else {
        ctx.moveTo(ox, oy + p);
        ctx.lineTo(ox + gw, oy + p);
      }
    }
    ctx.stroke();
  };
  const interior = (n: number) => Array.from({ length: n - 1 }, (_, i) => i + 1);
  const major = (i: number) => i % 5 === 0;

  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = T.gridLine;
  line(interior(layout.width).filter((i) => !major(i)), "x");
  line(interior(layout.height).filter((i) => !major(i)), "y");
  ctx.strokeStyle = T.gridLineMajor;
  line(interior(layout.width).filter(major), "x");
  line(interior(layout.height).filter(major), "y");
  ctx.restore();
}

function drawObject(
  ctx: DrawContext,
  obj: PlacedObject,
  def: ObjectDefinition,
  o: RenderOptions,
  ox: number,
  oy: number,
  lw: number,
): void {
  const s = o.cellSize;
  const { width, height } = getFootprintSize(obj, def);
  const x = ox + obj.x * s;
  const y = oy + obj.y * s;
  const w = width * s;
  const h = height * s;
  const fill = obj.colorOverride ?? def.color;
  const radius = Math.max(2, Math.round(s / 16));

  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  // The dark ring sits inside the footprint, as in the editor.
  roundedRect(ctx, x + lw, y + lw, w - 2 * lw, h - 2 * lw, Math.max(1, radius - lw));
  ctx.strokeStyle = T.objectEdge;
  ctx.lineWidth = lw * 2;
  ctx.stroke();

  const showIcon = def.icon !== undefined && Math.min(w, h) >= MIN_PX_FOR_ICON;
  const label = o.showLabels && obj.label ? obj.label : null;
  const labelPx = Math.max(11, Math.round(s * 0.3));
  const iconPx = Math.min(s * 0.85, Math.min(w, h) * 0.5);
  const gap = 2;
  const stack = (showIcon ? iconPx : 0) + (showIcon && label ? gap : 0) + (label ? labelPx * 1.2 : 0);
  let cursor = y + h / 2 - stack / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (showIcon) {
    ctx.font = `${Math.round(iconPx)}px ${EXPORT_EMOJI_FONT}`;
    ctx.fillStyle = "#000000";
    ctx.fillText(def.icon as string, x + w / 2, cursor + iconPx / 2);
    cursor += iconPx + gap;
  }
  if (label) {
    ctx.font = `700 ${labelPx}px ${EXPORT_FONT}`;
    ctx.fillStyle = labelColorFor(fill);
    ctx.fillText(fitText(ctx, label, w - 8), x + w / 2, cursor + (labelPx * 1.2) / 2);
  }
  ctx.restore();
}

function drawCoordinates(ctx: DrawContext, layout: FarmLayout, o: RenderOptions, ox: number, oy: number) {
  const s = o.cellSize;
  const ruler = rulerSize(o);
  const every = s >= 24 ? 1 : 5;
  ctx.save();
  ctx.fillStyle = T.inkSoft;
  ctx.font = `600 ${Math.max(10, Math.round(s * 0.3))}px ${EXPORT_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let x = 0; x < layout.width; x += every) {
    ctx.fillText(String(x), ox + x * s + s / 2, oy - ruler / 2);
  }
  ctx.textAlign = "right";
  for (let y = 0; y < layout.height; y += every) {
    ctx.fillText(String(y), ox - ruler * 0.25, oy + y * s + s / 2);
  }
  ctx.restore();
}

/**
 * Draws the layout onto `ctx`: background, effects, grid, objects with icons and labels, then
 * coordinates. The context must already be sized to `exportSize(layout, options)`.
 */
export function drawLayout(
  ctx: DrawContext,
  layout: FarmLayout,
  defs: ObjectDefinition[],
  o: RenderOptions,
): void {
  if (o.projection === "iso") {
    drawIsoLayout(ctx, layout, defs, o);
    return;
  }
  const { width: totalW, height: totalH } = exportSize(layout, o);
  const ox = o.padding + rulerSize(o);
  const oy = ox;
  const gw = layout.width * o.cellSize;
  const gh = layout.height * o.cellSize;
  const lw = Math.max(1, Math.round(o.cellSize / 32));
  const defsById = new Map(defs.map((d) => [d.id, d]));

  if (o.background) {
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, totalW, totalH);
  }
  ctx.fillStyle = T.board;
  ctx.fillRect(ox, oy, gw, gh);

  if (o.showEffects) drawEffects(ctx, layout, defsById, defs, o, ox, oy, lw);
  if (o.showGrid) drawGrid(ctx, layout, o, ox, oy, lw);

  // The board's frame, outside the cells like the editor's ring.
  ctx.save();
  ctx.strokeStyle = T.boardEdge;
  ctx.lineWidth = lw * 2;
  ctx.strokeRect(ox - lw, oy - lw, gw + 2 * lw, gh + 2 * lw);
  ctx.restore();

  for (const obj of layout.objects) {
    const def = defsById.get(obj.defId);
    if (def) drawObject(ctx, obj, def, o, ox, oy, lw);
  }

  if (o.showCoordinates) drawCoordinates(ctx, layout, o, ox, oy);
}

/** Renders the layout to a new canvas. `createCanvas` defaults to a DOM canvas. */
export function renderLayoutToCanvas(
  layout: FarmLayout,
  defs: ObjectDefinition[],
  options: RenderOptions,
  createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): HTMLCanvasElement {
  const { width, height } = exportSize(layout, options);
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  drawLayout(ctx, layout, defs, options);
  return canvas;
}

/** `canvas` as a PNG blob. Rejects if the browser cannot encode it (too large, out of memory). */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not create the image. Try a smaller size."));
    }, "image/png");
  });
}
