import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import DragGhost from "./components/Grid/DragGhost";
import GridCanvas from "./components/Grid/GridCanvas";
import Inspector from "./components/Inspector/Inspector";
import Palette from "./components/Palette/Palette";
import { useGridDrag } from "./hooks/useGridDrag";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import TopBar from "./components/TopBar";
import { onStorageError, type StorageErrorEvent } from "./lib/storage";
import { useLayoutStore } from "./store/layoutStore";
import type { PlacedObject } from "./types";

const FIRST_RUN_SIZE = 17;

function StorageToast() {
  const [event, setEvent] = useState<StorageErrorEvent | null>(null);
  useEffect(() => onStorageError(setEvent), []);
  if (!event) return null;

  const text =
    event.kind === "quota"
      ? "Browser storage is full, so your latest changes were not saved. Export your layouts to back them up."
      : event.message;
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-card bg-ink px-4 py-3 text-sm text-paper shadow-float"
    >
      <svg
        aria-hidden
        className="mt-0.5 shrink-0"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 2.5 16.5 15h-15L9 2.5ZM9 7.5v3.5M9 13h.01" />
      </svg>
      <span className="flex-1">{text}</span>
      <button
        type="button"
        className="rounded-control px-1 font-semibold underline transition duration-150 ease-soft hover:bg-paper/15"
        onClick={() => setEvent(null)}
      >
        Dismiss
      </button>
    </div>
  );
}

function Workspace() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { drag, startPaletteDrag, startObjectDrag } = useGridDrag(gridRef);
  useKeyboardShortcuts();

  // Pressing an object selects it (Shift/Ctrl/Cmd toggles it in or out), then may start a drag.
  const onObjectPointerDown = (e: ReactPointerEvent<HTMLElement>, obj: PlacedObject) => {
    const { setSelection, toggleSelected } = useLayoutStore.getState();
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelected(obj.id);
      return;
    }
    setSelection([obj.id]);
    startObjectDrag(e, obj);
  };

  const onObjectActivate = (e: ReactKeyboardEvent<HTMLElement>, obj: PlacedObject) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const { setSelection, toggleSelected } = useLayoutStore.getState();
    if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSelected(obj.id);
    else setSelection([obj.id]);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Palette onItemPointerDown={startPaletteDrag} />
      <GridCanvas
        gridRef={gridRef}
        hiddenObjectId={drag?.objectId ?? null}
        onObjectPointerDown={onObjectPointerDown}
        onObjectActivate={onObjectActivate}
      />
      <Inspector />
      <DragGhost drag={drag} />
    </main>
  );
}

export default function App() {
  // First run (or all layouts deleted elsewhere): start with one empty layout.
  useEffect(() => {
    if (useLayoutStore.getState().activeLayoutId === null) {
      useLayoutStore.getState().createLayout("Farm 1", FIRST_RUN_SIZE, FIRST_RUN_SIZE);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-page text-ink">
      <TopBar />
      <Workspace />
      <StorageToast />
    </div>
  );
}
