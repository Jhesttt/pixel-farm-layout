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
import { useElementWidth } from "../../hooks/useElementWidth";
import { PHONE_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { EFFECT_FILL_ALPHA } from "../../lib/effectStyle";
import { getFootprintSize } from "../../lib/grid";
import {
  classifyIsoPoint,
  diamondPoints,
  isoBillboard,
  isoCellAt,
  toSvgPoints,
  type IsoBlock,
  type IsoView,
} from "../../lib/iso";
import { buildIsoModel, isoBlockFor, type IsoObjectModel } from "../../lib/isoModel";
import { useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import { EXPORT_EMOJI_FONT, EXPORT_THEME as T } from "../../theme/exportTheme";
import { shadeColor } from "../../theme/contrast";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../../types";
import BoardHeader from "./BoardHeader";
import EffectPattern from "./EffectPattern";

const SCENE_PADDING = 16;
const MIN_FIT_TILE = 12;
const MAX_FIT_TILE = 96;
const MIN_TILE = 10;
const MAX_TILE = 160;
const ZOOM_STEP = 1.25;
const PAN_THRESHOLD_PX = 4;

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
  model,
  selected,
  hidden,
  onPointerDown,
  onKeyDown,
}: {
  model: IsoObjectModel;
  selected: boolean;
  hidden: boolean;
  onPointerDown: (e: ReactPointerEvent<Element>) => void;
  onKeyDown: (e: ReactKeyboardEvent<Element>) => void;
}) {
  const { obj, def, block, billboard: bb, label, lineWidth } = model;
  const silhouette = toSvgPoints(model.silhouette);

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
      <polygon points={toSvgPoints([block.base.left, block.base.bottom, block.top.bottom, block.top.left])} fill={model.fillLeft} />
      <polygon points={toSvgPoints([block.base.bottom, block.base.right, block.top.right, block.top.bottom])} fill={model.fillRight} />
      <polygon points={toSvgPoints(diamondPoints(block.top))} fill={model.fill} />
      <polygon points={silhouette} fill="none" stroke={T.objectEdge} strokeWidth={lineWidth} strokeLinejoin="round" />
      <polygon
        points={toSvgPoints(diamondPoints(block.top))}
        fill="none"
        stroke={T.objectEdge}
        strokeWidth={lineWidth * 0.6}
        strokeLinejoin="round"
        opacity={0.55}
      />

      {bb && (
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
            x={label.rect.x}
            y={label.rect.y}
            width={label.rect.width}
            height={label.rect.height}
            rx={label.rect.height / 2}
            fill={T.paper}
            stroke={T.badgeEdge}
            strokeWidth={1}
          />
          <text
            x={label.textX}
            y={label.textY}
            fontSize={label.px}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill={model.labelColor}
          >
            {label.text}
          </text>
        </g>
      )}

      {selected && (
        <g pointerEvents="none" fill="none" strokeLinejoin="round">
          <polygon points={silhouette} stroke={T.paper} strokeWidth={lineWidth + 6} />
          <polygon points={silhouette} stroke={T.primary} strokeWidth={lineWidth + 2.5} />
        </g>
      )}
    </g>
  );
}

/** The object being dragged, drawn where it would land: solid green and a check, or dashed red and a cross. */
function IsoGhost({ drag, def, view }: { drag: DragState; def: ObjectDefinition; view: IsoView }) {
  const probe: PlacedObject = { id: "ghost", defId: def.id, x: 0, y: 0, rotation: drag.rotation, showEffect: true };
  const { width, height } = getFootprintSize(probe, def);
  const block = isoBlockFor(view, def, drag.x, drag.y, width, height);
  const silhouette = toSvgPoints([block.base.left, block.base.bottom, block.base.right, block.top.right, block.top.top, block.top.left]);
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

const segmentPath = (segments: { a: { x: number; y: number }; b: { x: number; y: number } }[]) =>
  segments.map((s) => `M${s.a.x} ${s.a.y}L${s.b.x} ${s.b.y}`).join("");

/**
 * The isometric board: the same layout as the top view, drawn as raised blocks with their icons
 * standing on them. It supports the same interactions (select, place, move, rotate, drag off to
 * delete) through the pointer mapping it registers in `mapperRef`.
 *
 * The header (name, view switch, zoom) sits outside the scrolling area so it stays put while the
 * board is zoomed and panned.
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

  const hiddenId = drag?.objectId ?? null;
  const defsById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  const model = useMemo(
    () =>
      buildIsoModel(layout, definitions, {
        tile,
        padding: SCENE_PADDING,
        showGrid: view.showGrid,
        showLabels: view.showLabels,
        showEffects: view.showEffects,
        showCoordinates: true,
        hiddenObjectId: hiddenId,
        effectPreview: drag?.overGrid ? { defId: drag.defId, x: drag.x, y: drag.y, rotation: drag.rotation } : null,
      }),
    [layout, definitions, tile, view.showGrid, view.showLabels, view.showEffects, hiddenId, drag?.overGrid, drag?.defId, drag?.x, drag?.y, drag?.rotation],
  );
  const iv = model.view;

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

  const ghostDef = drag?.overGrid ? defsById.get(drag.defId) : undefined;

  return (
    <section className="order-1 flex min-h-0 flex-1 flex-col md:order-2">
      <div style={{ padding: `${outer}px ${outer}px 12px` }}>
        <BoardHeader
          layout={layout}
          zoom={{
            canZoomOut: tile > MIN_TILE,
            canZoomIn: tile < MAX_TILE,
            canFit: zoom !== null,
            onZoomOut: () => setZoom(Math.round(tile / ZOOM_STEP)),
            onZoomIn: () => setZoom(Math.round(tile * ZOOM_STEP)),
            onFit: () => setZoom(null),
          }}
        />
      </div>

      <div
        ref={scrollerRef}
        data-board-scroller
        className="min-h-0 flex-1 overflow-auto"
        style={{ padding: `0 ${outer}px ${outer}px` }}
      >
        <div className="mx-auto rounded-card bg-paper shadow-soft" style={{ width: model.width }}>
          <svg
            ref={svgRef}
            width={model.width}
            height={model.height}
            viewBox={`0 0 ${model.width} ${model.height}`}
            role="group"
            aria-label={`Isometric view of ${layout.name}`}
            className="block max-w-none"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            <defs>
              <pattern id="pfl-iso-ghost-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M-2 2 2 -2M0 8 8 0M6 10 10 6" stroke={T.negative} strokeWidth="1.5" opacity="0.55" />
              </pattern>
              {model.effects.map((e) => (
                <EffectPattern key={e.key} id={`pfl-iso-fx-${e.key}`} kind={e.patternKind} color={e.edge} />
              ))}
            </defs>

            {/* the ground: drag to pan, click to deselect */}
            <polygon
              points={toSvgPoints(diamondPoints(model.ground))}
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
              <path d={segmentPath(model.gridMinor)} stroke={T.gridLine} strokeWidth={model.gridLineWidth} fill="none" />
              <path d={segmentPath(model.gridMajor)} stroke={T.gridLineMajor} strokeWidth={model.gridLineWidth} fill="none" />

              <g fill={T.inkSoft} fontSize={model.rulerPx} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                {model.rulers.map((r, i) => (
                  <text key={i} x={r.x} y={r.y}>
                    {r.text}
                  </text>
                ))}
              </g>

              {model.effects.map((e) => {
                const points = toSvgPoints(diamondPoints(e.diamond));
                return (
                  <g key={e.key}>
                    <polygon points={points} fill={e.color} fillOpacity={EFFECT_FILL_ALPHA} />
                    <polygon points={points} fill={`url(#pfl-iso-fx-${e.key})`} opacity={0.4} />
                    <polygon
                      points={points}
                      fill="none"
                      stroke={e.edge}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeDasharray={e.preview ? "2 4" : "7 4"}
                    />
                  </g>
                );
              })}

              {model.badges.map((b) => (
                <g key={`${b.x},${b.y}`}>
                  <rect x={b.x - b.width / 2} y={b.y - b.height / 2} width={b.width} height={b.height} rx={b.height / 2} fill={T.paper} stroke={T.badgeEdge} />
                  <text x={b.x} y={b.y} fontSize={b.px} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={T.inkDeep}>
                    {b.text}
                  </text>
                </g>
              ))}
            </g>

            {model.objects.map((m) => (
              <IsoObject
                key={m.obj.id}
                model={m}
                selected={selection.includes(m.obj.id)}
                hidden={m.obj.id === hiddenId}
                onPointerDown={(e) => onObjectPointerDown(e, m.obj)}
                onKeyDown={(e) => onObjectActivate(e, m.obj)}
              />
            ))}

            {drag && ghostDef && <IsoGhost drag={drag} def={ghostDef} view={iv} />}
          </svg>
        </div>
      </div>
    </section>
  );
}
