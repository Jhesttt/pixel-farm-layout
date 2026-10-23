import { diamondPoints, isoScene, type Point } from "./iso";
import { buildIsoModel, type IsoEffectModel, type IsoModel, type IsoObjectModel, type IsoSegment } from "./isoModel";
import type { DrawContext, RenderOptions } from "./renderToCanvas";
import { EXPORT_EMOJI_FONT, EXPORT_FONT, EXPORT_THEME as T } from "../theme/exportTheme";
import type { FarmLayout, ObjectDefinition } from "../types";

// The isometric PNG. It draws the same scene model as the on-screen isometric board, so the image
// matches what you see (without the selection ring and ghost, which are interactive state).

/** An export "cell size" of 32 gives a tile 48px wide, matching a comfortable on-screen zoom. */
const TILE_PER_CELL = 1.5;
/** Line widths are tuned for a 48px tile on screen; larger exports scale them up. */
const REFERENCE_TILE = 48;
const EFFECT_FILL_ALPHA = 0.3;

/** Width of one cell's diamond, in px, for these export options. */
export function isoExportTile(o: RenderOptions): number {
  return Math.max(8, Math.round(o.cellSize * TILE_PER_CELL));
}

/** Output size in pixels. */
export function isoExportSize(layout: FarmLayout, o: RenderOptions): { width: number; height: number } {
  const { width, height } = isoScene(layout.width, layout.height, isoExportTile(o), o.padding);
  return { width, height };
}

function polygon(ctx: DrawContext, points: Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function segments(ctx: DrawContext, list: IsoSegment[]): void {
  ctx.beginPath();
  for (const s of list) {
    ctx.moveTo(s.a.x, s.a.y);
    ctx.lineTo(s.b.x, s.b.y);
  }
  ctx.stroke();
}

function roundedRect(ctx: DrawContext, x: number, y: number, w: number, h: number): void {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawEffect(ctx: DrawContext, e: IsoEffectModel, k: number): void {
  const points = diamondPoints(e.diamond);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  ctx.save();
  // tint: translucent, so overlapping areas darken each other
  polygon(ctx, points);
  ctx.globalAlpha = EFFECT_FILL_ALPHA;
  ctx.fillStyle = e.color;
  ctx.fill();

  // texture, clipped to the area
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = e.edge;
  ctx.fillStyle = e.edge;
  ctx.lineWidth = 1.3 * k;
  polygon(ctx, points);
  ctx.clip();
  const step = 8 * k;
  ctx.beginPath();
  if (e.patternKind === 0 || e.patternKind === 1) {
    const h = y1 - y0;
    for (let x = x0 - h; x < x1; x += step) {
      if (e.patternKind === 0) {
        ctx.moveTo(x, y1);
        ctx.lineTo(x + h, y0);
      } else {
        ctx.moveTo(x, y0);
        ctx.lineTo(x + h, y1);
      }
    }
    ctx.stroke();
  } else {
    for (let x = x0 + step / 2; x < x1; x += step) {
      for (let y = y0 + step / 2; y < y1; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.3 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // dashed outline
  ctx.save();
  polygon(ctx, points);
  ctx.strokeStyle = e.edge;
  ctx.lineWidth = 2 * k;
  ctx.setLineDash([7 * k, 4 * k]);
  ctx.stroke();
  ctx.restore();
}

function drawObject(ctx: DrawContext, m: IsoObjectModel): void {
  const { block, billboard: bb, label } = m;
  const { base, top } = block;

  ctx.save();
  polygon(ctx, [base.left, base.bottom, top.bottom, top.left]);
  ctx.fillStyle = m.fillLeft;
  ctx.fill();
  polygon(ctx, [base.bottom, base.right, top.right, top.bottom]);
  ctx.fillStyle = m.fillRight;
  ctx.fill();
  polygon(ctx, diamondPoints(top));
  ctx.fillStyle = m.fill;
  ctx.fill();

  ctx.strokeStyle = T.objectEdge;
  ctx.lineWidth = m.lineWidth;
  polygon(ctx, m.silhouette);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = m.lineWidth * 0.6;
  polygon(ctx, diamondPoints(top));
  ctx.stroke();
  ctx.restore();

  if (bb && m.def.icon) {
    ctx.save();
    ctx.fillStyle = "rgba(42, 22, 22, 0.22)";
    ctx.beginPath();
    ctx.ellipse(bb.cx, bb.cy + bb.size * 0.02, bb.size * 0.3, bb.size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(bb.size * 0.78)}px ${EXPORT_EMOJI_FONT}`;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.def.icon, bb.cx, bb.cy - bb.size * 0.4);
    ctx.restore();
  }

  if (label) {
    ctx.save();
    roundedRect(ctx, label.rect.x, label.rect.y, label.rect.width, label.rect.height);
    ctx.fillStyle = T.paper;
    ctx.fill();
    ctx.strokeStyle = T.badgeEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 ${label.px}px ${EXPORT_FONT}`;
    ctx.fillStyle = m.labelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.text, label.textX, label.textY);
    ctx.restore();
  }
}

function drawModel(ctx: DrawContext, model: IsoModel, o: RenderOptions): void {
  const k = Math.max(1, model.view.tile / REFERENCE_TILE);

  if (o.background) {
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, model.width, model.height);
  }

  // the ground, with its frame
  ctx.save();
  polygon(ctx, diamondPoints(model.ground));
  ctx.fillStyle = T.board;
  ctx.fill();
  ctx.strokeStyle = T.boardEdge;
  ctx.lineWidth = 3 * k;
  ctx.lineJoin = "round" as CanvasLineJoin;
  ctx.stroke();
  ctx.restore();

  if (model.gridMinor.length + model.gridMajor.length > 0) {
    ctx.save();
    ctx.lineWidth = model.gridLineWidth * k;
    ctx.strokeStyle = T.gridLine;
    segments(ctx, model.gridMinor);
    ctx.strokeStyle = T.gridLineMajor;
    segments(ctx, model.gridMajor);
    ctx.restore();
  }

  if (model.rulers.length > 0) {
    ctx.save();
    ctx.font = `600 ${model.rulerPx}px ${EXPORT_FONT}`;
    ctx.fillStyle = T.inkSoft;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of model.rulers) ctx.fillText(r.text, r.x, r.y);
    ctx.restore();
  }

  for (const e of model.effects) drawEffect(ctx, e, k);

  for (const b of model.badges) {
    ctx.save();
    roundedRect(ctx, b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
    ctx.fillStyle = T.paper;
    ctx.fill();
    ctx.strokeStyle = T.badgeEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 ${b.px}px ${EXPORT_FONT}`;
    ctx.fillStyle = T.inkDeep;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.x, b.y);
    ctx.restore();
  }

  for (const m of model.objects) drawObject(ctx, m);
}

/**
 * Draws the layout isometrically onto `ctx`: background, ground, grid, edge numbers, areas of
 * effect, stack counts, then the objects back to front with their icons and labels. The context
 * must already be sized to `isoExportSize(layout, options)`.
 */
export function drawIsoLayout(
  ctx: DrawContext,
  layout: FarmLayout,
  defs: ObjectDefinition[],
  o: RenderOptions,
): void {
  const model = buildIsoModel(layout, defs, {
    tile: isoExportTile(o),
    padding: o.padding,
    showGrid: o.showGrid,
    showLabels: o.showLabels,
    showEffects: o.showEffects,
    showCoordinates: o.showCoordinates,
  });
  drawModel(ctx, model, o);
}
