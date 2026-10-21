import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { canPlace, classifyPointer, clampGrab, getFootprintSize, pointerToCell } from "../lib/grid";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";
import type { ObjectDefinition, PlacedObject } from "../types";

/** Pointer travel before a press becomes a drag, so plain clicks stay clicks. */
const DRAG_THRESHOLD_PX = 4;

/** Dragging a placed object this far (or more) off the board deletes it; closer just cancels. */
export const DELETE_MARGIN_PX = 16;

export interface DragState {
  kind: "palette" | "grid";
  defId: string;
  /** The object being moved; null when dragging a new one from the palette. */
  objectId: string | null;
  rotation: PlacedObject["rotation"];
  /** Top-left cell of the ghost. May be off the grid; `valid` is then false. */
  x: number;
  y: number;
  valid: boolean;
  /** Whether the pointer is over the grid (the ghost snaps to cells only then). */
  overGrid: boolean;
  /** A placed object held away from the board: releasing now deletes it. */
  deleting: boolean;
  /** Fill and icon to draw on the ghost. */
  color: string;
  icon: string | undefined;
  /** Ghost rectangle in viewport pixels. */
  ghost: { left: number; top: number; width: number; height: number };
}

interface Session {
  kind: DragState["kind"];
  def: ObjectDefinition;
  objectId: string | null;
  color: string;
  rotation: PlacedObject["rotation"];
  /** Which cell of the footprint is held, so multi-cell objects do not jump to the pointer. */
  grab: { dx: number; dy: number };
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
}

function probeFor(session: Session): PlacedObject {
  return {
    id: session.objectId ?? "drag-ghost",
    defId: session.def.id,
    x: 0,
    y: 0,
    rotation: session.rotation,
    showEffect: true,
  };
}

/**
 * Pointer-event drag for both sources: a palette item (places a new object) and a placed object
 * (moves it). Press, move past a small threshold, release over a valid spot to commit; Escape
 * cancels and R rotates the ghost while dragging.
 *
 * `gridRef` must be the element whose top-left is cell (0, 0) and whose width is the grid width.
 */
export function useGridDrag(gridRef: RefObject<HTMLElement | null>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

  const evaluate = useCallback(
    (session: Session): DragState | null => {
      const grid = gridRef.current;
      const layout = selectActiveLayout(useLayoutStore.getState());
      if (!grid || !layout) return null;

      const defs = useLibraryStore.getState().definitions;
      const rect = grid.getBoundingClientRect();
      const cellSize = rect.width / layout.width;
      const probe = probeFor(session);
      const size = getFootprintSize(probe, session.def);

      // The board is the visible part of the grid; the grid can extend under other panels.
      const scroller = grid.closest("[data-board-scroller]")?.getBoundingClientRect() ?? null;
      const zone = classifyPointer({ x: session.lastX, y: session.lastY }, rect, scroller, DELETE_MARGIN_PX);
      const overGrid = zone === "over";
      const deleting = session.kind === "grid" && zone === "away";
      const cell = pointerToCell(session.lastX, session.lastY, rect, cellSize);
      const x = cell.x - session.grab.dx;
      const y = cell.y - session.grab.dy;
      const valid =
        overGrid &&
        canPlace(layout, defs, { ...probe, x, y }, session.objectId ? [session.objectId] : []);

      // On the grid the ghost snaps to cells; off it, it follows the pointer freely.
      const ghost = overGrid
        ? { left: rect.left + x * cellSize, top: rect.top + y * cellSize }
        : {
            left: session.lastX - (session.grab.dx + 0.5) * cellSize,
            top: session.lastY - (session.grab.dy + 0.5) * cellSize,
          };

      return {
        kind: session.kind,
        defId: session.def.id,
        objectId: session.objectId,
        rotation: session.rotation,
        x,
        y,
        valid,
        overGrid,
        deleting,
        color: session.color,
        icon: session.def.icon,
        ghost: { ...ghost, width: size.width * cellSize, height: size.height * cellSize },
      };
    },
    [gridRef],
  );

  const begin = useCallback(
    (
      e: ReactPointerEvent<HTMLElement>,
      init: Pick<Session, "kind" | "def" | "objectId" | "color" | "rotation" | "grab">,
    ) => {
      if (e.button !== 0 || sessionRef.current) return;
      e.preventDefault();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best effort; document-level listeners still receive the events.
      }

      const session: Session = {
        ...init,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        active: false,
      };
      sessionRef.current = session;

      const finish = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", finish);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("scroll", onScroll, true);
        try {
          target.releasePointerCapture(session.pointerId);
        } catch {
          // Already released.
        }
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        sessionRef.current = null;
        teardownRef.current = null;
        setDrag(null);
      };

      const refresh = () => setDrag(evaluate(session));

      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== session.pointerId) return;
        session.lastX = ev.clientX;
        session.lastY = ev.clientY;
        if (!session.active) {
          const travelled = Math.hypot(ev.clientX - session.startX, ev.clientY - session.startY);
          if (travelled < DRAG_THRESHOLD_PX) return;
          session.active = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }
        refresh();
      }

      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== session.pointerId) return;
        session.lastX = ev.clientX;
        session.lastY = ev.clientY;
        if (session.active) {
          const result = evaluate(session);
          if (result?.deleting && session.objectId) {
            useLayoutStore.getState().removeObjects([session.objectId]);
          } else if (result?.valid) {
            const store = useLayoutStore.getState();
            const defs = useLibraryStore.getState().definitions;
            if (session.objectId) {
              store.moveObject(session.objectId, result.x, result.y, defs, result.rotation);
            } else {
              const id = store.placeObject(
                { defId: session.def.id, x: result.x, y: result.y, rotation: result.rotation, showEffect: true },
                defs,
              );
              if (id) store.setSelection([id]);
            }
          }
        }
        finish();
      }

      function onKey(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          finish();
        } else if ((ev.key === "r" || ev.key === "R") && !ev.repeat && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          session.rotation = ((session.rotation + 90) % 360) as PlacedObject["rotation"];
          session.grab = clampGrab(session.grab, getFootprintSize(probeFor(session), session.def));
          if (session.active) refresh();
        }
      }

      // The grid can scroll under a stationary pointer, which changes the cell it is over.
      function onScroll() {
        if (session.active) refresh();
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", finish);
      // Capture phase, so Escape and R are consumed here before the selection shortcuts see them.
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", onScroll, true);
      teardownRef.current = finish;
    },
    [evaluate],
  );

  const startPaletteDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, def: ObjectDefinition) => {
      // Hold the middle of the footprint, as if the object were picked up by its centre.
      const grab = {
        dx: Math.floor(def.width / 2),
        dy: Math.floor(def.height / 2),
      };
      begin(e, { kind: "palette", def, objectId: null, color: def.color, rotation: 0, grab });
    },
    [begin],
  );

  const startObjectDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, obj: PlacedObject) => {
      const grid = gridRef.current;
      const layout = selectActiveLayout(useLayoutStore.getState());
      const def = useLibraryStore.getState().definitions.find((d) => d.id === obj.defId);
      if (!grid || !layout || !def) return;

      const rect = grid.getBoundingClientRect();
      const cell = pointerToCell(e.clientX, e.clientY, rect, rect.width / layout.width);
      const grab = clampGrab(
        { dx: cell.x - obj.x, dy: cell.y - obj.y },
        getFootprintSize(obj, def),
      );
      begin(e, {
        kind: "grid",
        def,
        objectId: obj.id,
        color: obj.colorOverride ?? def.color,
        rotation: obj.rotation,
        grab,
      });
    },
    [begin, gridRef],
  );

  // Abandon any drag in progress if the owner unmounts.
  useEffect(() => () => teardownRef.current?.(), []);

  return { drag, startPaletteDrag, startObjectDrag };
}
