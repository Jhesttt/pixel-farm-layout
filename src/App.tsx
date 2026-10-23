import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import DragGhost from "./components/Grid/DragGhost";
import GridCanvas from "./components/Grid/GridCanvas";
import Inspector from "./components/Inspector/Inspector";
import Palette from "./components/Palette/Palette";
import { createTopMapper, type BoardMapper } from "./hooks/boardMapper";
import { useGridDrag } from "./hooks/useGridDrag";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import TopBar from "./components/TopBar";
import { onStorageError, type StorageErrorEvent } from "./lib/storage";
import { selectActiveLayout, useLayoutStore } from "./store/layoutStore";
import { removeRetiredPlacements } from "./store/retired";
import type { PlacedObject } from "./types";

const FIRST_RUN_SIZE = 17;

function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-card bg-ink px-4 py-3 text-sm text-paper shadow-float"
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
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

function StorageToast() {
  const [event, setEvent] = useState<StorageErrorEvent | null>(null);
  useEffect(() => onStorageError(setEvent), []);
  if (!event) return null;
  const text =
    event.kind === "quota"
      ? "Browser storage is full, so your latest changes were not saved. Export your layouts to back them up."
      : event.message;
  return <Toast text={text} onDismiss={() => setEvent(null)} />;
}

type DockTab = "objects" | "edit";

function Workspace() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isoMapperRef = useRef<BoardMapper | null>(null);
  const projection = useLayoutStore((s) => s.view.projection);
  // Phones show one panel at a time under the board; larger screens show both beside it.
  const [dockTab, setDockTab] = useState<DockTab>("objects");
  const selectionCount = useLayoutStore((s) => s.selection.length);
  // Whichever board is on screen turns pointer positions into cells; read fresh on every event.
  const getMapper = useCallback((): BoardMapper | null => {
    const state = useLayoutStore.getState();
    if (state.view.projection === "iso") return isoMapperRef.current;
    const layout = selectActiveLayout(state);
    return gridRef.current && layout ? createTopMapper(gridRef.current, layout.width) : null;
  }, []);
  const { drag, startPaletteDrag, startObjectDrag } = useGridDrag(getMapper);
  useKeyboardShortcuts();

  // Pressing an object selects it (Shift/Ctrl/Cmd toggles it in or out), then may start a drag.
  const onObjectPointerDown = (e: ReactPointerEvent<Element>, obj: PlacedObject) => {
    const { setSelection, toggleSelected } = useLayoutStore.getState();
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelected(obj.id);
      return;
    }
    setSelection([obj.id]);
    setDockTab("edit"); // on a phone, tapping an object opens its settings
    startObjectDrag(e, obj);
  };

  const onObjectActivate = (e: ReactKeyboardEvent<Element>, obj: PlacedObject) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const { setSelection, toggleSelected } = useLayoutStore.getState();
    if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSelected(obj.id);
    else setSelection([obj.id]);
    setDockTab("edit");
  };

  const tabs: { key: DockTab; label: string }[] = [
    { key: "objects", label: "Objects" },
    { key: "edit", label: selectionCount > 0 ? `Edit (${selectionCount})` : "Edit" },
  ];

  return (
    <main className="flex min-h-0 flex-1 flex-col md:flex-row">
      <GridCanvas
        gridRef={gridRef}
        drag={drag}
        isoMapperRef={isoMapperRef}
        onObjectPointerDown={onObjectPointerDown}
        onObjectActivate={onObjectActivate}
      />
      {/* Below the board on phones; "contents" on larger screens so the panels flank it. */}
      <div className="order-2 flex h-[36dvh] shrink-0 flex-col border-t border-line bg-paper md:contents">
        <div role="tablist" aria-label="Panels" className="flex gap-1 border-b border-line p-1 md:hidden">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={dockTab === t.key}
              className={`h-10 flex-1 rounded-control font-semibold transition duration-150 ease-soft ${
                dockTab === t.key ? "bg-primary text-on-primary" : "text-ink-soft hover:bg-wash"
              }`}
              onClick={() => setDockTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Palette onItemPointerDown={startPaletteDrag} hiddenOnMobile={dockTab !== "objects"} />
        <Inspector hiddenOnMobile={dockTab !== "edit"} />
      </div>
      {/* The isometric board draws its own ghost while over it; this one covers everything else. */}
      <DragGhost drag={projection === "top" || !drag?.overGrid ? drag : null} />
    </main>
  );
}

export default function App() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Saved layouts may still use built-ins this version dropped; their definitions are gone, so
    // the objects would linger invisibly. Remove them and say so.
    const removed = removeRetiredPlacements();
    if (removed > 0) {
      setNotice(
        `${removed} placed ${removed === 1 ? "object was" : "objects were"} removed because the Tree, Barn, Sprinkler, Fence and Water objects are no longer included.`,
      );
    }
    // First run (or all layouts deleted elsewhere): start with one empty layout.
    if (useLayoutStore.getState().activeLayoutId === null) {
      useLayoutStore.getState().createLayout("Farm 1", FIRST_RUN_SIZE, FIRST_RUN_SIZE);
    }
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page text-ink">
      <TopBar />
      <Workspace />
      <StorageToast />
      {notice && <Toast text={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
