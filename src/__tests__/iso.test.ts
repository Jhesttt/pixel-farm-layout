import { describe, expect, it } from "vitest";
import {
  classifyIsoPoint,
  diamondPoints,
  isoBillboard,
  isoBlock,
  isoCellAt,
  isoDiamond,
  isoDrawOrder,
  isoProject,
  isoScene,
  isoSilhouette,
  isoUnproject,
  toSvgPoints,
  type IsoRect,
  type IsoView,
} from "../lib/iso";

const view: IsoView = { tile: 64, originX: 500, originY: 100 };

describe("isoProject / isoUnproject", () => {
  it("puts grid corner (0, 0) at the origin", () => {
    expect(isoProject(view, 0, 0)).toEqual({ x: 500, y: 100 });
  });

  it("moves +x to the lower right and +y to the lower left, one cell being a 2:1 diamond", () => {
    expect(isoProject(view, 1, 0)).toEqual({ x: 532, y: 116 });
    expect(isoProject(view, 0, 1)).toEqual({ x: 468, y: 116 });
    expect(isoProject(view, 1, 1)).toEqual({ x: 500, y: 132 });
  });

  it("round-trips any grid point", () => {
    for (const [gx, gy] of [[0, 0], [3.5, 7.25], [16.9, 0.1], [-2, 4], [20, 20]] as const) {
      const back = isoUnproject(view, isoProject(view, gx, gy));
      expect(back.gx).toBeCloseTo(gx, 9);
      expect(back.gy).toBeCloseTo(gy, 9);
    }
  });

  it("finds the cell under a screen point", () => {
    const centreOfCell = isoProject(view, 5.5, 3.5);
    expect(isoCellAt(view, centreOfCell)).toEqual({ x: 5, y: 3 });
    // just inside each corner of the cell
    expect(isoCellAt(view, isoProject(view, 5.01, 3.01))).toEqual({ x: 5, y: 3 });
    expect(isoCellAt(view, isoProject(view, 5.99, 3.99))).toEqual({ x: 5, y: 3 });
    expect(isoCellAt(view, isoProject(view, 6.01, 3.5))).toEqual({ x: 6, y: 3 });
  });

  it("gives negative cells outside the top-left of the grid", () => {
    expect(isoCellAt(view, isoProject(view, -0.5, 2.5))).toEqual({ x: -1, y: 2 });
  });
});

describe("isoScene", () => {
  it("contains all four corners of the board, inside the padding", () => {
    const { width, height, view: v } = isoScene(17, 12, 40, 16);
    const corners = [isoProject(v, 0, 0), isoProject(v, 17, 0), isoProject(v, 0, 12), isoProject(v, 17, 12)];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(16);
      expect(c.x).toBeLessThanOrEqual(width - 16);
      expect(c.y).toBeGreaterThanOrEqual(16);
      expect(c.y).toBeLessThanOrEqual(height - 16);
    }
  });

  it("fits the board exactly horizontally and leaves headroom above for icons", () => {
    const { width, view: v } = isoScene(10, 10, 40, 0);
    expect(isoProject(v, 0, 10).x).toBe(0); // left corner touches the edge
    expect(isoProject(v, 10, 0).x).toBe(width); // right corner too
    expect(v.originY).toBeGreaterThan(40); // room above the top corner
  });

  it("grows with the tile size", () => {
    const small = isoScene(15, 15, 20, 8);
    const big = isoScene(15, 15, 40, 8);
    expect(big.width).toBeGreaterThan(small.width);
    expect(big.height).toBeGreaterThan(small.height);
  });
});

describe("blocks and billboards", () => {
  it("builds a diamond for a footprint, with top/right/bottom/left corners", () => {
    const d = isoDiamond(view, 2, 1, 3, 2);
    expect(d.top).toEqual(isoProject(view, 2, 1));
    expect(d.right).toEqual(isoProject(view, 5, 1));
    expect(d.bottom).toEqual(isoProject(view, 5, 3));
    expect(d.left).toEqual(isoProject(view, 2, 3));
  });

  it("lifts the top face straight up by the slab height", () => {
    const b = isoBlock(view, 0, 0, 1, 1);
    expect(b.lift).toBeGreaterThan(0);
    expect(b.top.top.y).toBe(b.base.top.y - b.lift);
    expect(b.top.left.x).toBe(b.base.left.x);
  });

  it("outlines a block as a six-point silhouette", () => {
    const b = isoBlock(view, 0, 0, 1, 1);
    const s = isoSilhouette(b);
    expect(s).toHaveLength(6);
    expect(s[0]).toEqual(b.base.left);
    expect(s[4]).toEqual(b.top.top);
  });

  it("stands an icon at the centre of the top face, larger for bigger footprints", () => {
    const small = isoBillboard(view, 4, 4, 1, 1);
    const big = isoBillboard(view, 4, 4, 4, 4);
    const centre = isoProject(view, 4.5, 4.5);
    expect(small.cx).toBe(centre.x);
    expect(small.cy).toBeLessThan(centre.y); // lifted onto the top face
    expect(big.size).toBeGreaterThan(small.size);
    expect(small.rect.y + small.rect.height).toBeGreaterThan(small.cy); // the icon's base is at the block
  });

  it("formats points for an SVG attribute", () => {
    expect(toSvgPoints(diamondPoints(isoDiamond(view, 0, 0, 1, 1)))).toBe("500,100 532,116 500,132 468,116");
  });
});

const rect = (id: string, x: number, y: number, w = 1, h = 1): IsoRect => ({ id, x0: x, y0: y, x1: x + w, y1: y + h });
const ids = (items: IsoRect[]) => items.map((i) => i.id);

describe("isoDrawOrder", () => {
  it("draws neighbours toward the top corner first", () => {
    expect(ids(isoDrawOrder([rect("front", 1, 0), rect("back", 0, 0)]))).toEqual(["back", "front"]);
    expect(ids(isoDrawOrder([rect("front", 0, 1), rect("back", 0, 0)]))).toEqual(["back", "front"]);
  });

  it("draws a big block before small ones in front of it, however they are listed", () => {
    const barn = rect("barn", 0, 0, 4, 4);
    const right = rect("right", 4, 1); // beside the barn, toward +x
    const below = rect("below", 2, 4); // beside the barn, toward +y
    for (const list of [[barn, right, below], [below, right, barn], [right, below, barn]]) {
      const order = ids(isoDrawOrder(list));
      expect(order.indexOf("barn")).toBeLessThan(order.indexOf("right"));
      expect(order.indexOf("barn")).toBeLessThan(order.indexOf("below"));
    }
  });

  it("draws small objects behind a big block before it", () => {
    const small = rect("small", 0, 2);
    const big = rect("big", 1, 0, 3, 5); // starts right of `small` and spans its rows
    expect(ids(isoDrawOrder([big, small]))).toEqual(["small", "big"]);
  });

  it("orders a diagonal pair by depth", () => {
    expect(ids(isoDrawOrder([rect("near", 5, 5), rect("far", 1, 1)]))).toEqual(["far", "near"]);
  });

  it("is deterministic for items that do not constrain each other", () => {
    const a = isoDrawOrder([rect("b", 3, 0), rect("a", 0, 3)]);
    const b = isoDrawOrder([rect("a", 0, 3), rect("b", 3, 0)]);
    expect(ids(a)).toEqual(ids(b));
  });

  it("returns every item exactly once, and handles empty and single inputs", () => {
    expect(isoDrawOrder([])).toEqual([]);
    expect(ids(isoDrawOrder([rect("only", 2, 2)]))).toEqual(["only"]);
  });

  it("never draws an item in front of one that is in front of it (random layouts)", () => {
    // simple seeded generator, so the test is repeatable
    let seed = 12345;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let round = 0; round < 40; round++) {
      const taken = new Set<string>();
      const items: IsoRect[] = [];
      for (let i = 0; i < 40; i++) {
        const w = 1 + next(4);
        const h = 1 + next(4);
        const x = next(20 - w);
        const y = next(20 - h);
        const cells: string[] = [];
        for (let cx = x; cx < x + w; cx++) for (let cy = y; cy < y + h; cy++) cells.push(`${cx},${cy}`);
        if (cells.some((c) => taken.has(c))) continue;
        cells.forEach((c) => taken.add(c));
        items.push(rect(`o${i}`, x, y, w, h));
      }
      const sorted = isoDrawOrder([...items].reverse());
      expect(sorted).toHaveLength(items.length);
      const position = new Map(sorted.map((r, i) => [r.id, i]));
      for (const a of items) {
        for (const b of items) {
          if (a === b) continue;
          const aBehindB =
            (a.x1 <= b.x0 && (a.y1 <= b.y0 || (a.y0 < b.y1 && b.y0 < a.y1))) ||
            (a.y1 <= b.y0 && a.x0 < b.x1 && b.x0 < a.x1);
          if (aBehindB) {
            expect(position.get(a.id) as number, `${a.id} behind ${b.id}`).toBeLessThan(position.get(b.id) as number);
          }
        }
      }
    }
  });
});

describe("classifyIsoPoint", () => {
  const v: IsoView = { tile: 64, originX: 500, originY: 100 };
  const at = (gx: number, gy: number, margin = 16) => classifyIsoPoint(v, 10, 10, isoProject(v, gx, gy), margin);

  it("is over the board anywhere inside the diamond", () => {
    expect(at(5, 5)).toBe("over");
    expect(at(0.5, 0.5)).toBe("over");
    expect(at(9.5, 9.5)).toBe("over");
    expect(at(0.2, 9.8)).toBe("over");
  });

  it("is near just outside an edge and away from further out", () => {
    expect(at(-0.1, 5)).toBe("near"); // a few px past the upper-left edge
    expect(at(10.1, 5)).toBe("near");
    expect(at(5, 10.1)).toBe("near");
    expect(at(-3, 5)).toBe("away");
    expect(at(15, 15)).toBe("away");
  });

  it("measures the margin from the diamond's edge", () => {
    // 1 cell outside along +x is about 29px from the edge (the edge slopes 2:1)
    expect(at(11, 5, 40)).toBe("near");
    expect(at(11, 5, 10)).toBe("away");
  });

  it("is away for a point far above the board", () => {
    expect(classifyIsoPoint(v, 10, 10, { x: 500, y: -500 }, 16)).toBe("away");
  });
});
