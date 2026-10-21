import { RETIRED_BUILTIN_IDS } from "../data/builtIns";
import { useLayoutStore } from "./layoutStore";
import { useLibraryStore } from "./libraryStore";

/**
 * Removes placements, in every saved layout, of built-ins this version no longer ships. Without
 * this they would linger invisibly, since their definitions are gone. A retired id that is still in
 * the library (re-added by an import as a custom object) is left alone. Returns how many were removed.
 */
export function removeRetiredPlacements(): number {
  const have = new Set(useLibraryStore.getState().definitions.map((d) => d.id));
  let removed = 0;
  for (const id of RETIRED_BUILTIN_IDS) {
    if (!have.has(id)) removed += useLayoutStore.getState().removeObjectsByDef(id);
  }
  return removed;
}
