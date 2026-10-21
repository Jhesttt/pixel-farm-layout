import { useEffect } from "react";
import { selectActiveLayout, useLayoutStore } from "../store/layoutStore";
import { useLibraryStore } from "../store/libraryStore";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** The selected ids that still exist in the active layout. */
function liveSelection(): string[] {
  const state = useLayoutStore.getState();
  const layout = selectActiveLayout(state);
  if (!layout) return [];
  return state.selection.filter((id) => layout.objects.some((o) => o.id === id));
}

/**
 * Editor shortcuts on the selection: Delete/Backspace remove, R rotates, arrows nudge one cell,
 * Ctrl/Cmd+D duplicates, Escape deselects. Ignored while typing in a field. Undo and redo join
 * in step 9.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;

      const store = useLayoutStore.getState();
      const defs = useLibraryStore.getState().definitions;
      const ids = liveSelection();
      const modifier = e.ctrlKey || e.metaKey;

      if (modifier && !e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault(); // the browser would bookmark the page
        if (ids.length > 0) store.duplicateObjects(ids, defs);
        return;
      }
      if (modifier || e.altKey) return;

      if (e.key === "Escape") {
        if (store.selection.length > 0) store.setSelection([]);
      } else if (ids.length === 0) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        store.removeObjects(ids);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        store.rotateObjects(ids, defs);
      } else if (e.key in ARROWS) {
        e.preventDefault(); // keep the page from scrolling
        const [dx, dy] = ARROWS[e.key] as [number, number];
        store.nudgeObjects(ids, dx, dy, defs);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
