import { effectPatternIndex } from "./effectStyle";
import { computeEffectAreas, type EffectPreview } from "./effects";
import { getFootprintSize } from "./grid";
import {
  ISO_SLAB_RATIO,
  isoBillboard,
  isoBlock,
  isoDiamond,
  isoDrawOrder,
  isoProject,
  isoScene,
  isoSilhouette,
  type Diamond,
  type IsoBillboard,
  type IsoBlock,
  type IsoView,
  type Point,
} from "./iso";
import { LABEL_INK, effectEdgeColor, shadeColor } from "../theme/contrast";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

// Everything needed to draw a layout isometrically, as plain data. The on-screen SVG board and the
// PNG export both draw from this, so they cannot drift apart.

/** Things with no icon (a path) lie nearly flat instead of standing as a slab. */
export const ISO_FLAT_LIFT_RATIO = 0.07;
/** Below this tile width the stack-count badges are left out: they would not fit. */
export const ISO_MIN_TILE_FOR_BADGES = 24;
/** Below this tile width the edge numbers are left out. */
export const ISO_MIN_TILE_FOR_RULERS = 20;

export interface IsoModelOptions {
  /** Width of one cell's diamond, in px. */
  tile: number;
  /** Space around the board, in px. */
  padding: number;
  showGrid: boolean;
  showLabels: boolean;
  showEffects: boolean;
  /** Numbers along the two upper edges of the board. */
  showCoordinates: boolean;
  /** An object being dragged: its own effect is left out (a preview replaces it). */
  hiddenObjectId?: string | null;
  effectPreview?: EffectPreview | null;
}

export interface IsoLabelModel {
  text: string;
  /** Font size in px. */
  px: number;
  /** The pill behind the text. */
  rect: { x: number; y: number; width: number; height: number };
  textX: number;
  textY: number;
}

export interface IsoObjectModel {
  obj: PlacedObject;
  def: ObjectDefinition;
  fill: string;
  /** Left and right side faces, darker than `fill`. */
  fillLeft: string;
  fillRight: string;
  block: IsoBlock;
  silhouette: Point[];
  /** The icon standing on the block; null for things without one. */
  billboard: IsoBillboard | null;
  label: IsoLabelModel | null;
  /** Colour of the label text. */
  labelColor: string;
  /** Outline thickness in px. */
  lineWidth: number;
}

export interface IsoEffectModel {
  key: string;
  def: ObjectDefinition;
  /** The area on the ground, as a diamond. */
  diamond: Diamond;
  color: string;
  edge: string;
  patternKind: number;
  preview: boolean;
}

export interface IsoBadgeModel {
  x: number;
  y: number;
  n: number;
  text: string;
  px: number;
  /** The pill behind the text, centred on (x, y). */
  width: number;
  height: number;
}

export interface IsoRulerLabel {
  text: string;
  x: number;
  y: number;
}

export interface IsoSegment {
  a: Point;
  b: Point;
}

export interface IsoModel {
  width: number;
  height: number;
  view: IsoView;
  /** The whole board as one diamond. */
  ground: Diamond;
  gridMinor: IsoSegment[];
  gridMajor: IsoSegment[];
  gridLineWidth: number;
  rulerPx: number;
  rulers: IsoRulerLabel[];
  effects: IsoEffectModel[];
  badges: IsoBadgeModel[];
  /** Back to front: draw in this order. */
  objects: IsoObjectModel[];
}

/** The block for an object or ghost: slabs for things with icons, nearly flat for those without. */
export function isoBlockFor(view: IsoView, def: ObjectDefinition, x: number, y: number, w: number, h: number): IsoBlock {
  return isoBlock(view, x, y, w, h, def.icon ? ISO_SLAB_RATIO : ISO_FLAT_LIFT_RATIO);
}

function gridSegments(view: IsoView, cols: number, rows: number): { minor: IsoSegment[]; major: IsoSegment[] } {
  const minor: IsoSegment[] = [];
  const major: IsoSegment[] = [];
  const add = (i: number, a: Point, b: Point) => (i % 5 === 0 ? major : minor).push({ a, b });
  for (let i = 1; i < cols; i++) add(i, isoProject(view, i, 0), isoProject(view, i, rows));
  for (let j = 1; j < rows; j++) add(j, isoProject(view, 0, j), isoProject(view, cols, j));
  return { minor, major };
}

function rulerLabels(view: IsoView, cols: number, rows: number, tile: number): IsoRulerLabel[] {
  const every = tile >= 30 ? 1 : 5;
  const labels: IsoRulerLabel[] = [];
  for (let i = 0; i < cols; i += every) {
    const p = isoProject(view, i + 0.5, 0);
    labels.push({ text: String(i), x: p.x + tile * 0.15, y: p.y - tile * 0.2 });
  }
  for (let j = 0; j < rows; j += every) {
    const p = isoProject(view, 0, j + 0.5);
    labels.push({ text: String(j), x: p.x - tile * 0.15, y: p.y - tile * 0.2 });
  }
  return labels;
}

/** The layout laid out for isometric drawing. */
export function buildIsoModel(layout: FarmLayout, defs: ObjectDefinition[], o: IsoModelOptions): IsoModel {
  const { width: cols, height: rows } = layout;
  const { tile } = o;
  const scene = isoScene(cols, rows, tile, o.padding);
  const view = scene.view;
  const defsById = new Map(defs.map((d) => [d.id, d]));

  // objects, back to front
  const known: { obj: PlacedObject; def: ObjectDefinition; width: number; height: number }[] = [];
  for (const obj of layout.objects) {
    const def = defsById.get(obj.defId);
    if (!def) continue;
    const { width, height } = getFootprintSize(obj, def);
    known.push({ obj, def, width, height });
  }
  const byId = new Map(known.map((k) => [k.obj.id, k]));
  const order = isoDrawOrder(
    known.map((k) => ({ id: k.obj.id, x0: k.obj.x, y0: k.obj.y, x1: k.obj.x + k.width, y1: k.obj.y + k.height })),
  );

  const labelPx = Math.max(10, Math.round(tile * 0.24));
  const objects: IsoObjectModel[] = order.map((r) => {
    const { obj, def, width, height } = byId.get(r.id) as (typeof known)[number];
    const fill = obj.colorOverride ?? def.color;
    const block = isoBlockFor(view, def, obj.x, obj.y, width, height);
    const bb = isoBillboard(view, obj.x, obj.y, width, height);
    const text = o.showLabels && obj.label ? obj.label : null;

    let label: IsoLabelModel | null = null;
    if (text) {
      const pillW = text.length * labelPx * 0.6 + 12;
      const anchorY = def.icon ? bb.rect.y - 4 : block.top.top.y + (block.top.bottom.y - block.top.top.y) / 2;
      label = {
        text,
        px: labelPx,
        rect: { x: bb.cx - pillW / 2, y: anchorY - labelPx - 6, width: pillW, height: labelPx + 8 },
        textX: bb.cx,
        textY: anchorY - labelPx / 2 - 2,
      };
    }

    return {
      obj,
      def,
      fill,
      fillLeft: shadeColor(fill, 0.36),
      fillRight: shadeColor(fill, 0.2),
      block,
      silhouette: isoSilhouette(block),
      billboard: def.icon ? bb : null,
      label,
      labelColor: LABEL_INK, // the pill behind a label is paper, so the text is ink
      lineWidth: Math.max(1.4, tile / 28),
    };
  });

  // effects and stack badges
  const overlay = o.showEffects
    ? computeEffectAreas(layout, defs, o.hiddenObjectId ?? null, o.effectPreview ?? null)
    : { areas: [], stacked: [] };
  const effects: IsoEffectModel[] = overlay.areas.map((a) => {
    const effect = a.def.effect as NonNullable<ObjectDefinition["effect"]>;
    return {
      key: a.key,
      def: a.def,
      diamond: isoDiamond(view, a.bounds.x, a.bounds.y, a.bounds.width, a.bounds.height),
      color: effect.color,
      edge: effectEdgeColor(effect.color),
      patternKind: effectPatternIndex(a.def.id),
      preview: a.preview,
    };
  });
  const badgePx = Math.max(11, Math.round(tile * 0.2));
  const badges: IsoBadgeModel[] =
    tile >= ISO_MIN_TILE_FOR_BADGES
      ? overlay.stacked.map(({ x, y, n }) => {
          const centre = isoProject(view, x + 0.5, y + 0.5);
          const text = `×${n}`;
          return { x: centre.x, y: centre.y, n, text, px: badgePx, width: text.length * badgePx * 0.64 + 10, height: badgePx + 7 };
        })
      : [];

  const grid = o.showGrid ? gridSegments(view, cols, rows) : { minor: [], major: [] };

  return {
    width: scene.width,
    height: scene.height,
    view,
    ground: isoDiamond(view, 0, 0, cols, rows),
    gridMinor: grid.minor,
    gridMajor: grid.major,
    gridLineWidth: tile >= 40 ? 1.25 : 1,
    rulerPx: Math.max(9, Math.round(tile * 0.22)),
    rulers: o.showCoordinates && tile >= ISO_MIN_TILE_FOR_RULERS ? rulerLabels(view, cols, rows, tile) : [],
    effects,
    badges,
    objects,
  };
}

