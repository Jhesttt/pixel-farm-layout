import { nanoid } from "nanoid";
import { buildExport, parseImport, prepareImport, serializeExport, type ImportReport } from "../lib/exchange";
import { useLayoutStore } from "./layoutStore";
import { useLibraryStore } from "./libraryStore";

// JSON export and import across the two stores. The pure parts live in lib/exchange.ts.

/** The export file text for one layout, or null if it does not exist. */
export function exportLayoutText(id: string): string | null {
  const layout = useLayoutStore.getState().layouts[id];
  if (!layout) return null;
  return serializeExport(buildExport([layout], useLibraryStore.getState().definitions, Date.now()));
}

/** The export file text for every layout (the manual backup), or null if there are none. */
export function exportAllText(): string | null {
  const layouts = Object.values(useLayoutStore.getState().layouts);
  if (layouts.length === 0) return null;
  return serializeExport(buildExport(layouts, useLibraryStore.getState().definitions, Date.now()));
}

export type ImportOutcome =
  | { ok: true; names: string[]; report: ImportReport }
  | { ok: false; error: string };

/**
 * Validates an export file and adds its layouts (activating the first) and any definitions this
 * library lacks. Nothing changes if the file is rejected.
 */
export function importFromText(text: string): ImportOutcome {
  const parsed = parseImport(text);
  if (!parsed.ok) return parsed;

  const library = useLibraryStore.getState();
  const { layouts, definitionsToAdd, report } = prepareImport(
    parsed.value,
    library.definitions,
    nanoid,
    Date.now(),
  );
  library.mergeDefinitions(definitionsToAdd);
  useLayoutStore.getState().addLayouts(layouts);
  return { ok: true, names: layouts.map((l) => l.name), report };
}
