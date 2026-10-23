import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DELETE_MARGIN_PX, type BoardMapper } from "../../hooks/boardMapper";
import type { DragState } from "../../hooks/useGridDrag";
import { PHONE_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { useElementWidth } from "../../hooks/useElementWidth";
import { EFFECT_FILL_ALPHA, effectPatternIndex } from "../../lib/effectStyle";
import { computeEffectAreas } from "../../lib/effects";
import { getFootprintSize } from "../../lib/grid";
import {
  ISO_SLAB_RATIO,
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
  toSvgPoints,
  type IsoBlock,
  type IsoView,
} from "../../lib/iso";
import { useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import { effectEdgeColor, labelColorFor, shadeColor } from "../../theme/contrast";
import { EXPORT_EMOJI_FONT, EXPORT_THEME as T } from "../../theme/exportTheme";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../../types";
import BoardHeader from "./BoardHeader";
import EffectPattern from "./EffectPattern";

const SCENE_PADDING = 16;
const MIN_FIT_TILE = 12;
const MAX_FIT_TILE = 96;
const MIN_TILE = 10;
const MAX_TILE = 160;
const ZOOM_STEP = 1.25;
/** Things with no icon (a path) lie nearly flat instead of standing as a slab. */
const FLAT_LIFT_RATIO = 0.07;
const PAN_THRESHOLD_PX = 4;
const MIN_TILE_FOR_COUNT = 24;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

interface IsoCanvasProps {
  layout: FarmLayout;
  /** The drag in progress, if any: hides the dragged object, previews its effect and draws its ghost. */
  drag: DragState | null;
  /** Filled in with this board's pointer-to-cell mapping, for the drag hook to use. */
  mapperRef: MutableRefObject<BoardMapper | null>;
  onObjectPointerDown: (e: ReactPointerEvent<Element>, obj: PlacedObject) => void;
  onObjectActivate: (e: ReactKeyboardEvent<Element>, obj: PlacedObject) => void;
}

function describe(obj: PlacedObject, def: ObjectDefinition): string {
  const name = obj.label ? `${def.name}, ${obj.label}` : def.name;
  return `${name} at column ${obj.x}, row ${obj.y}`;
}

interface Item {
  obj: PlacedObject;
  def: ObjectDefinition;
  width: number;
  height: number;
}

function blockFor(view: IsoView, def: ObjectDefinition, x: number, y: number, w: number, h: number): IsoBlock {
  return isoBlock(view, x, y, w, h, def.icon ? ISO_SLAB_RATIO : FLAT_LIFT_RATIO);
}

/** The three visible faces of a block, in `fill` with darker sides. */
function BlockFaces({ block, fill }: { block: IsoBlock; fill: string }) {
  const { base, top } = block;
  return (
    <>
      <polygon points={toSvgPoints([base.left, base.bottom, top.bottom, top.left])} fill={shadeColor(fill, 0.36)} />
      <polygon points={toSvgPoints([base.bottom, base.right, top.right, top.bottom])} fill={shadeColor(fill, 0.2)} />
      <polygon points={toSvgPoints(diamondPoints(top))} fill={fill} />
    </>
  );
}

function IsoObject({
  item,
  view,
  selected,
  hidden,
  showLabels,
  onPointerDown,
  onKeyDown,
}: {
  item: Item;
  view: IsoView;
  selected: boolean;
  hidden: boolean;
  showLabels: boolean;
  onPointerDown: (e: ReactPointerEvent<Element>) => void;
  onKeyDown: (e: ReactKeyboardEvent<Element>) => void;
}) {
  const { obj, def, width, height } = item;
  const fill = obj.colorOverride ?? def.color;
  const block = blockFor(view, def, obj.x, obj.y, width, height);
  const silhouette = toSvgPoints(isoSilhouette(block));
  const bb = isoBillboard(view, obj.x, obj.y, width, height);
  const strokeW = Math.max(1.4, view.tile / 28);
  const labelPx = Math.max(10, Math.round(view.tile * 0.24));
  const label = showLabels && obj.label ? obj.label : null;
  const labelW = label ? label.length * labelPx * 0.6 + 12 : 0;
  const labelY = def.icon ? bb.rect.y - 4 : block.top.top.y + (block.top.bottom.y - block.top.top.y) / 2;

  return (
    <g
      data-object-id={obj.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={describe(obj, def)}
      opacity={hidden ? 0 : 1}
      style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <BlockFaces block={block} fill={fill} />
      <polygon points={silhouette} fill="none" stroke={T.objectEdge} strokeWidth={strokeW} strokeLinejoin="round" />
      <polygon
        points={toSvgPoints(diamondPoints(block.top))}
        fill="none"
        stroke={T.objectEdge}
        strokeWidth={strokeW * 0.6}
        strokeLinejoin="round"
        opacity={0.55}
      />

      {def.icon && (
        <>
          <ellipse cx={bb.cx} cy={bb.cy + bb.size * 0.02} rx={bb.size * 0.3} ry={bb.size * 0.1} fill="rgba(42, 22, 22, 0.22)" />
          <rect x={bb.rect.x} y={bb.rect.y} width={bb.rect.width} height={bb.rect.height} fill="transparent" />
          <text
            x={bb.cx}
            y={bb.cy - bb.size * 0.4}
            fontSize={bb.size * 0.78}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={EXPORT_EMOJI_FONT}
            style={{ userSelect: "none" }}
            pointerEvents="none"
          >
            {def.icon}
          </text>
        </>
      )}

      {label && (
        <g pointerEvents="none">
          <rect
            x={bb.cx - labelW / 2}
            y={labelY - labelPx - 6}
            width={labelW}
            height={labelPx + 8}
            rx={(labelPx + 8) / 2}
            fill={T.paper}
            stroke={T.badgeEdge}
            strokeWidth={1}
          />
          <text
            x={bb.cx}
            y={labelY - labelPx / 2 - 2}
            fontSize={labelPx}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill={labelColorFor(T.paper)}
          >
            {label}
          </text>
        </g>
      )}

      {selected && (
        <g pointerEvents="none" fill="none" strokeLinejoin="round">
          <polygon points={silhouette} stroke={T.paper} strokeWidth={strokeW + 6} />
          <polygon points={silhouette} stroke={T.primary} strokeWidth={strokeW + 2.5} />
        </g>
      )}
    </g>
  );
}

/** The object being dragged, drawn where it would land: solid green and a check, or dashed red and a cross. */
function IsoGhost({ drag, def, view }: { drag: DragState; def: ObjectDefinition; view: IsoView }) {
  const probe: PlacedObject = { id: "ghost", defId: def.id, x: 0, y: 0, rotation: drag.rotation, showEffect: true };
  const { width, height } = getFootprintSize(probe, def);
  const block = blockFor(view, def, drag.x, drag.y, width, height);
  const silhouette = toSvgPoints(isoSilhouette(block));
  const bb = isoBillboard(view, drag.x, drag.y, width, height);
  const stroke = drag.valid ? T.sageDeep : T.negative;
  const badge = { x: block.top.right.x + 4, y: block.top.right.y - 6 };

  return (
    <g pointerEvents="none">
      <g opacity={0.72}>
        <BlockFaces block={block} fill={drag.color} />
      </g>
      {!drag.valid && <polygon points={silhouette} fill="url(#pfl-iso-ghost-hatch)" />}
      <polygon
        points={silhouette}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeDasharray={drag.valid ? undefined : "7 4"}
      />
      {def.icon && (
        <text
          x={bb.cx}
          y={bb.cy - bb.size * 0.4}
          fontSize={bb.size * 0.78}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={EXPORT_EMOJI_FONT}
          opacity={0.85}
        >
          {def.icon}
        </text>
      )}
      <circle cx={badge.x} cy={badge.y} r={11} fill={stroke} />
      <g
        transform={`translate(${badge.x - 6} ${badge.y - 6})`}
        fill="none"
        stroke={T.paper}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drag.valid ? <path d="m2 6.5 2.7 2.7L10 3.5" /> : <path d="m2.5 2.5 7 7m0-7-7 7" />}
      </g>
    </g>
  );
}

/**
 * The isometric board: the same layout as the top view, drawn as raised blocks with their icons
 * standing on them. It supports the same interactions (select, place, move, rotate, drag off to
 * delete) through the pointer mapping it registers in `mapperRef`.
 */
export default function IsoCanvas({ layout, drag, mapperRef, onObjectPointerDown, onObjectActivate }: IsoCanvasProps) {
  const definitions = useLibraryStore((s) => s.definitions);
  const selection = useLayoutStore((s) => s.selection);
  const view = useLayoutStore((s) => s.view);
  const setSelection = useLayoutStore((s) => s.setSelection);
  const phone = useMediaQuery(PHONE_QUERY);
  const outer = phone ? 8 : 24;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerWidth = useElementWidth(scrollerRef);
  const [zoom, setZoom] = useState<number | null>(null);

  const { width: cols, height: rows } = layout;
  const fitTile =
    containerWidth === 0
      ? 40
      : clamp(Math.floor((containerWidth - 2 * outer - 2 * SCENE_PADDING) / ((cols + rows) / 2)), MIN_FIT_TILE, MAX_FIT_TILE);
  const tile = clamp(zoom ?? fitTile, MIN_TILE, MAX_TILE);
  const scene = useMemo(() => isoScene(cols, rows, tile, SCENE_PADDING), [cols, rows, tile]);
  const iv = scene.view;

  const hiddenId = drag?.objectId ?? null;
  const defsById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  // Objects back to front, so nearer ones paint over farther ones.
  const items = useMemo(() => {
    const known: Item[] = [];
    for (const obj of layout.objects) {
      const def = defsById.get(obj.defId);
      if (!def) continue;
      const { width, height } = getFootprintSize(obj, def);
      known.push({ obj, def, width, height });
    }
    const byId = new Map(known.map((i) => [i.obj.id, i]));
    const order = isoDrawOrder(
      known.map((i) => ({ id: i.obj.id, x0: i.obj.x, y0: i.obj.y, x1: i.obj.x + i.width, y1: i.obj.y + i.height })),
    );
    return order.map((r) => byId.get(r.id) as Item);
  }, [layout.objects, defsById]);

  const overlay = useMemo(
    () =>
      view.showEffects
        ? computeEffectAreas(
            layout,
            definitions,
            hiddenId,
            drag?.overGrid ? { defId: drag.defId, x: drag.x, y: drag.y, rotation: drag.rotation } : null,
          )
        : { areas: [], stacked: [] },
    [view.showEffects, layout, definitions, hiddenId, drag?.overGrid, drag?.defId, drag?.x, drag?.y, drag?.rotation],
  );

  // Tell the drag hook how to turn a pointer position into a cell on this board.
  useEffect(() => {
    const mapper: BoardMapper = {
      cellSize: tile * 0.7,
      locate(clientX, clientY) {
        const svg = svgRef.current;
        const scroller = scrollerRef.current;
        if (!svg || !scroller) return { cell: { x: -1, y: -1 }, zone: "away" };
        const box = svg.getBoundingClientRect();
        const p = { x: clientX - box.left, y: clientY - box.top };
        let zone = classifyIsoPoint(iv, cols, rows, p, DELETE_MARGIN_PX);
        // Only the part of the board that is on screen counts; the rest may sit under other panels.
        const s = scroller.getBoundingClientRect();
        const m = DELETE_MARGIN_PX;
        const inside = clientX >= s.left && clientX < s.right && clientY >= s.top && clientY < s.bottom;
        const close = clientX >= s.left - m && clientX < s.right + m && clientY >= s.top - m && clientY < s.bottom + m;
        if (!inside) zone = zone !== "away" && close ? "near" : "away";
        return { cell: isoCellAt(iv, p), zone };
      },
    };
    mapperRef.current = mapper;
    return () => {
      if (mapperRef.current === mapper) mapperRef.current = null;
    };
  }, [iv, tile, cols, rows, mapperRef]);

  // Dragging empty ground pans the board (the scene can be larger than the window); a plain click
  // on it clears the selection.
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const onGroundDown = (e: ReactPointerEvent<SVGPolygonElement>) => {
    if (e.button !== 0 || !scrollerRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      left: scrollerRef.current.scrollLeft,
      top: scrollerRef.current.scrollTop,
      moved: false,
    };
  };
  const onGroundMove = (e: ReactPointerEvent<SVGPolygonElement>) => {
    const p = pan.current;
    const scroller = scrollerRef.current;
    if (!p || !scroller) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
    p.moved = true;
    scroller.scrollLeft = p.left - dx;
    scroller.scrollTop = p.top - dy;
  };
  const onGroundUp = (e: ReactPointerEvent<SVGPolygonElement>) => {
    const p = pan.current;
    pan.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (p && !p.moved && !e.shiftKey && !e.ctrlKey && !e.metaKey) setSelection([]);
  };

  const ground = isoDiamond(iv, 0, 0, cols, rows);
  const gridLines = useMemo(() => {
    const line = (i: number, axis: "x" | "y") => {
      const a = axis === "x" ? isoProject(iv, i, 0) : isoProject(iv, 0, i);
      const b = axis === "x" ? isoProject(iv, i, rows) : isoProject(iv, cols, i);
      return `M${a.x} ${a.y}L${b.x} ${b.y}`;
    };
    let minor = "";
    let major = "";
    for (let i = 1; i < cols; i++) (i % 5 === 0 ? (major += line(i, "x")) : (minor += line(i, "x")));
    for (let i = 1; i < rows; i++) (i % 5 === 0 ? (major += line(i, "y")) : (minor += line(i, "y")));
    return { minor, major };
  }, [iv, cols, rows]);

  const labelEvery = tile >= 30 ? 1 : 5;
  const labelPx = Math.max(9, Math.round(tile * 0.22));
  const ghostDef = drag?.overGrid ? defsById.get(drag.defId) : undefined;
  const lineW = tile >= 40 ? 1.25 : 1;

  return (
    <div
      ref={scrollerRef}
      data-board-scroller
      className="order-1 min-h-0 flex-1 overflow-auto md:order-2"
      style={{ padding: outer }}
    >
      <div className="mx-auto" style={{ width: Math.max(scene.width, 320) }}>
        <BoardHeader layout={layout} />

        <div className="relative rounded-card bg-paper shadow-soft">
          <div role="group" aria-label="Zoom" className="absolute top-2 right-2 z-10 flex gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={tile <= MIN_TILE}
              className="btn btn-secondary h-8 w-8 px-0 text-base"
              onClick={() => setZoom(Math.round(tile / ZOOM_STEP))}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={tile >= MAX_TILE}
              className="btn btn-secondary h-8 w-8 px-0 text-base"
              onClick={() => setZoom(Math.round(tile * ZOOM_STEP))}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Fit to window"
              disabled={zoom === null}
              className="btn btn-secondary h-8 px-3 text-xs"
              onClick={() => setZoom(null)}
            >
              Fit
            </button>
          </div>

          <svg
            ref={svgRef}
            width={scene.width}
            height={scene.height}
            viewBox={`0 0 ${scene.width} ${scene.height}`}
            role="group"
            aria-label={`Isometric view of ${layout.name}`}
            className="mx-auto block max-w-none"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            <defs>
              <pattern id="pfl-iso-ghost-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M-2 2 2 -2M0 8 8 0M6 10 10 6" stroke={T.negative} strokeWidth="1.5" opacity="0.55" />
              </pattern>
              {overlay.areas.map(({ key, def }) => (
                <EffectPattern
                  key={key}
                  id={`pfl-iso-fx-${key}`}
                  kind={effectPatternIndex(def.id)}
                  color={effectEdgeColor(def.effect?.color ?? T.negative)}
                />
              ))}
            </defs>

            {/* the ground: drag to pan, click to deselect */}
            <polygon
              points={toSvgPoints(diamondPoints(ground))}
              fill={T.board}
              stroke={T.boardEdge}
              strokeWidth={3}
              strokeLinejoin="round"
              style={{ touchAction: "none", cursor: "grab" }}
              onPointerDown={onGroundDown}
              onPointerMove={onGroundMove}
              onPointerUp={onGroundUp}
              onPointerCancel={() => (pan.current = null)}
            />

            <g pointerEvents="none">
              {view.showGrid && (
                <>
                  <path d={gridLines.minor} stroke={T.gridLine} strokeWidth={lineW} fill="none" />
                  <path d={gridLines.major} stroke={T.gridLineMajor} strokeWidth={lineW} fill="none" />
                </>
              )}

              {tile >= 20 && (
                <g fill={T.inkSoft} fontSize={labelPx} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                  {Array.from({ length: cols }, (_, i) => i)
                    .filter((i) => i % labelEvery === 0)
                    .map((i) => {
                      const p = isoProject(iv, i + 0.5, 0);
                      return (
                        <text key={`x${i}`} x={p.x + tile * 0.15} y={p.y - tile * 0.2}>
                          {i}
                        </text>
                      );
                    })}
                  {Array.from({ length: rows }, (_, j) => j)
                    .filter((j) => j % labelEvery === 0)
                    .map((j) => {
                      const p = isoProject(iv, 0, j + 0.5);
                      return (
                        <text key={`y${j}`} x={p.x - tile * 0.15} y={p.y - tile * 0.2}>
                          {j}
                        </text>
                      );
                    })}
                </g>
              )}

              {overlay.areas.map(({ key, def, bounds, preview }) => {
                const effect = def.effect as NonNullable<ObjectDefinition["effect"]>;
                const points = toSvgPoints(diamondPoints(isoDiamond(iv, bounds.x, bounds.y, bounds.width, bounds.height)));
                return (
                  <g key={key}>
                    <polygon points={points} fill={effect.color} fillOpacity={EFFECT_FILL_ALPHA} />
                    <polygon points={points} fill={`url(#pfl-iso-fx-${key})`} opacity={0.4} />
                    <polygon
                      points={points}
                      fill="none"
                      stroke={effectEdgeColor(effect.color)}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeDasharray={preview ? "2 4" : "7 4"}
                    />
                  </g>
                );
              })}

              {tile >= MIN_TILE_FOR_COUNT &&
                overlay.stacked.map(({ x, y, n }) => {
                  const p = isoProject(iv, x + 0.5, y + 0.5);
                  const text = `×${n}`;
                  const w = text.length * 7 + 10;
                  return (
                    <g key={`${x},${y}`}>
                      <rect x={p.x - w / 2} y={p.y - 9} width={w} height={18} rx={9} fill={T.paper} stroke={T.badgeEdge} />
                      <text x={p.x} y={p.y} fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={T.inkDeep}>
                        {text}
                      </text>
                    </g>
                  );
                })}
            </g>

            {items.map((item) => (
              <IsoObject
                key={item.obj.id}
                item={item}
                view={iv}
                selected={selection.includes(item.obj.id)}
                hidden={item.obj.id === hiddenId}
                showLabels={view.showLabels}
                onPointerDown={(e) => onObjectPointerDown(e, item.obj)}
                onKeyDown={(e) => onObjectActivate(e, item.obj)}
              />
            ))}

            {drag && ghostDef && <IsoGhost drag={drag} def={ghostDef} view={iv} />}
          </svg>
        </div>
      </div>
    </div>
  );
}
