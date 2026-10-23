// Isometric (2:1 dimetric) projection for the isometric board view. Pure geometry: no DOM, no React.
//
// A grid cell becomes a diamond `tile` px wide and `tile / 2` px tall. Grid x runs toward the lower
// right of the screen and grid y toward the lower left, so cell (0, 0) is the top corner of the board
// (the top view turned 45 degrees clockwise).

export interface Point {
  x: number;
  y: number;
}

/** Where the grid sits on screen: `origin` is the screen position of grid corner (0, 0). */
export interface IsoView {
  /** Screen width of one cell's diamond, in px. */
  tile: number;
  originX: number;
  originY: number;
}

export interface Diamond {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
}

/** An object's footprint raised into a slab: the ground diamond and the same diamond lifted. */
export interface IsoBlock {
  base: Diamond;
  top: Diamond;
  /** How far the top face is lifted, in px. */
  lift: number;
}

export interface IsoBillboard {
  /** Where the icon stands: the centre of the block's top face. */
  cx: number;
  cy: number;
  /** Icon size in px. */
  size: number;
  /** The clickable box around the icon. */
  rect: { x: number; y: number; width: number; height: number };
}

/** Block height as a fraction of the tile width. */
export const ISO_SLAB_RATIO = 0.18;
/** Space reserved above the board for tall icons, in tile widths. */
export const ISO_HEADROOM_RATIO = 1.9;

/** Size of the whole scene and the view that places the grid in it. */
export function isoScene(
  cols: number,
  rows: number,
  tile: number,
  padding: number,
): { width: number; height: number; view: IsoView } {
  const headroom = tile * ISO_HEADROOM_RATIO;
  return {
    // whole pixels: a canvas or SVG of this size cannot have a fractional edge
    width: Math.ceil(((cols + rows) * tile) / 2 + 2 * padding),
    height: Math.ceil(((cols + rows) * tile) / 4 + headroom + 2 * padding),
    view: { tile, originX: padding + (rows * tile) / 2, originY: padding + headroom },
  };
}

/** Screen position of the grid point (gx, gy), measured in cells from corner (0, 0). */
export function isoProject(view: IsoView, gx: number, gy: number): Point {
  return {
    x: view.originX + ((gx - gy) * view.tile) / 2,
    y: view.originY + ((gx + gy) * view.tile) / 4,
  };
}

/** The grid point under a screen position on the ground plane. Inverse of `isoProject`. */
export function isoUnproject(view: IsoView, p: Point): { gx: number; gy: number } {
  const dx = (p.x - view.originX) / (view.tile / 2); // gx - gy
  const dy = (p.y - view.originY) / (view.tile / 4); // gx + gy
  return { gx: (dy + dx) / 2, gy: (dy - dx) / 2 };
}

/** The cell under a screen position (may be outside the grid). */
export function isoCellAt(view: IsoView, p: Point): { x: number; y: number } {
  const { gx, gy } = isoUnproject(view, p);
  return { x: Math.floor(gx), y: Math.floor(gy) };
}

/** The ground diamond of a `w` x `h` rectangle of cells whose top-left cell is (x, y). */
export function isoDiamond(view: IsoView, x: number, y: number, w: number, h: number): Diamond {
  return {
    top: isoProject(view, x, y),
    right: isoProject(view, x + w, y),
    bottom: isoProject(view, x + w, y + h),
    left: isoProject(view, x, y + h),
  };
}

export function liftDiamond(d: Diamond, dy: number): Diamond {
  const up = (p: Point): Point => ({ x: p.x, y: p.y - dy });
  return { top: up(d.top), right: up(d.right), bottom: up(d.bottom), left: up(d.left) };
}

/** `liftRatio` is the block height as a fraction of the tile width; flat things pass a smaller one. */
export function isoBlock(
  view: IsoView,
  x: number,
  y: number,
  w: number,
  h: number,
  liftRatio = ISO_SLAB_RATIO,
): IsoBlock {
  const base = isoDiamond(view, x, y, w, h);
  const lift = view.tile * liftRatio;
  return { base, top: liftDiamond(base, lift), lift };
}

/** The block's outline as seen from the front: its ground corners plus its lifted corners. */
export function isoSilhouette(block: IsoBlock): Point[] {
  return [block.base.left, block.base.bottom, block.base.right, block.top.right, block.top.top, block.top.left];
}

export function diamondPoints(d: Diamond): Point[] {
  return [d.top, d.right, d.bottom, d.left];
}

/** Points as an SVG `points` attribute. */
export function toSvgPoints(points: Point[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The icon that stands on a block. Larger footprints get larger icons. */
export function isoBillboard(view: IsoView, x: number, y: number, w: number, h: number): IsoBillboard {
  const block = isoBlock(view, x, y, w, h);
  const centre = isoProject(view, x + w / 2, y + h / 2);
  const cx = centre.x;
  const cy = centre.y - block.lift;
  const size = view.tile * Math.min(1.9, 0.7 + 0.22 * (Math.min(w, h) - 1));
  return { cx, cy, size, rect: { x: cx - size / 2, y: cy - size * 0.9, width: size, height: size } };
}

/** An axis-aligned footprint in cells; `x1` / `y1` are exclusive. */
export interface IsoRect {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** True when `a` is further from the viewer than `b`, so it must be drawn first. */
function isBehind(a: IsoRect, b: IsoRect): boolean {
  if (a.x1 <= b.x0 && (a.y1 <= b.y0 || overlaps(a.y0, a.y1, b.y0, b.y1))) return true;
  if (a.y1 <= b.y0 && overlaps(a.x0, a.x1, b.x0, b.x1)) return true;
  return false;
}

/**
 * Items in painter's order, back to front, for non-overlapping footprints of any size. Sorting by a
 * single key mis-orders a big block against small ones beside it; this honours every "A is behind B"
 * relation (a topological sort), and falls back to distance from the top corner for pairs that do
 * not constrain each other, so the result is stable.
 */
export function isoDrawOrder<T extends IsoRect>(items: T[]): T[] {
  const n = items.length;
  const key = (r: IsoRect) => r.x0 + r.x1 + r.y0 + r.y1;
  const incoming = new Array<number>(n).fill(0);
  const outgoing: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && isBehind(items[i] as T, items[j] as T)) {
        (outgoing[i] as number[]).push(j);
        incoming[j] = (incoming[j] as number) + 1;
      }
    }
  }

  const order = (a: number, b: number) =>
    key(items[a] as T) - key(items[b] as T) || (items[a] as T).id.localeCompare((items[b] as T).id);
  const ready = items.map((_, i) => i).filter((i) => incoming[i] === 0).sort(order);
  const placed = new Set<number>();
  const result: T[] = [];

  while (result.length < n) {
    // A cycle cannot occur for non-overlapping footprints; if bad data makes one, take the nearest
    // remaining item rather than loop forever.
    let next = ready.shift();
    if (next === undefined) {
      next = items.map((_, i) => i).filter((i) => !placed.has(i)).sort(order)[0] as number;
    }
    if (placed.has(next)) continue;
    placed.add(next);
    result.push(items[next] as T);
    for (const j of outgoing[next] as number[]) {
      incoming[j] = (incoming[j] as number) - 1;
      if (incoming[j] === 0 && !placed.has(j)) {
        ready.push(j);
        ready.sort(order);
      }
    }
  }
  return result;
}

function cross(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function insideConvex(poly: Point[], p: Point): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const c = cross(poly[i] as Point, poly[(i + 1) % poly.length] as Point, p);
    if (c !== 0) {
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) return false;
    }
  }
  return true;
}

function distanceToSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Where a screen point is relative to the whole board diamond: "over" it, "near" it (within
 * `margin` px of its edge, so overshooting is forgiven) or "away".
 */
export function classifyIsoPoint(
  view: IsoView,
  cols: number,
  rows: number,
  p: Point,
  margin: number,
): "over" | "near" | "away" {
  const poly = diamondPoints(isoDiamond(view, 0, 0, cols, rows));
  if (insideConvex(poly, p)) return "over";
  for (let i = 0; i < poly.length; i++) {
    if (distanceToSegment(poly[i] as Point, poly[(i + 1) % poly.length] as Point, p) <= margin) return "near";
  }
  return "away";
}
