import { z } from "zod";
import { findMisfits } from "./edit";
import { farmLayoutSchema, objectDefinitionSchema } from "./schemas";
import type { FarmLayout, ObjectDefinition } from "../types";

// JSON export / import of layouts. A file carries the layouts plus the object definitions they use,
// because custom definitions live in the library, not in a layout.

export const EXPORT_APP = "pixel-farm-layout";
export const EXPORT_FORMAT = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const exportEnvelopeSchema = z.object({
  app: z.literal(EXPORT_APP),
  format: z.number().int(),
  exportedAt: z.number(),
  layouts: z.array(farmLayoutSchema).min(1),
  definitions: z.array(objectDefinitionSchema),
});

export interface ExportEnvelope {
  app: typeof EXPORT_APP;
  format: number;
  exportedAt: number;
  layouts: FarmLayout[];
  definitions: ObjectDefinition[];
}

export interface ParsedImport {
  layouts: FarmLayout[];
  definitions: ObjectDefinition[];
}

export interface ImportReport {
  /** Definitions from the file that were new to this library. */
  addedDefinitions: number;
  /** Definitions from the file whose id already exists here; the local one is kept. */
  keptDefinitions: number;
  /** Objects removed because their definition is unknown. */
  droppedUnknown: number;
  /** Objects removed because they were out of bounds or overlapped another. */
  droppedMisfit: number;
}

/** The export file for these layouts, with only the definitions they use. */
export function buildExport(
  layouts: FarmLayout[],
  definitions: ObjectDefinition[],
  now: number,
): ExportEnvelope {
  const used = new Set(layouts.flatMap((l) => l.objects.map((o) => o.defId)));
  return {
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    exportedAt: now,
    layouts,
    definitions: definitions.filter((d) => used.has(d.id)),
  };
}

export function serializeExport(envelope: ExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/** Reads an export file (or a bare layout), validating everything. Never throws. */
export function parseImport(text: string): { ok: true; value: ParsedImport } | { ok: false; error: string } {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "That file is too large to be a layout export." };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  const envelope = exportEnvelopeSchema.safeParse(data);
  if (envelope.success) {
    if (envelope.data.format > EXPORT_FORMAT) {
      return { ok: false, error: "That file was made by a newer version of the app and cannot be read yet." };
    }
    return { ok: true, value: { layouts: envelope.data.layouts, definitions: envelope.data.definitions } };
  }

  const bare = farmLayoutSchema.safeParse(data);
  if (bare.success) return { ok: true, value: { layouts: [bare.data], definitions: [] } };

  const issue = envelope.error.issues[0];
  const where = issue && issue.path.length > 0 ? ` (problem at ${issue.path.join(".")})` : "";
  return { ok: false, error: `That file is not a Pixel Farm layout export${where}.` };
}

/**
 * Turns parsed layouts into ones safe to add: fresh layout ids, unique object ids, and only objects
 * that have a known definition and fit without overlap. Local definitions win over the file's.
 */
export function prepareImport(
  parsed: ParsedImport,
  existing: ObjectDefinition[],
  newId: () => string,
  now: number,
): { layouts: FarmLayout[]; definitionsToAdd: ObjectDefinition[]; report: ImportReport } {
  const have = new Set(existing.map((d) => d.id));
  const definitionsToAdd: ObjectDefinition[] = [];
  const incoming = new Set<string>();
  for (const def of parsed.definitions) {
    if (have.has(def.id) || incoming.has(def.id)) continue;
    incoming.add(def.id);
    definitionsToAdd.push(def);
  }
  const merged = [...existing, ...definitionsToAdd];
  const known = new Set(merged.map((d) => d.id));

  const report: ImportReport = {
    addedDefinitions: definitionsToAdd.length,
    keptDefinitions: new Set(parsed.definitions.map((d) => d.id)).size - definitionsToAdd.length,
    droppedUnknown: 0,
    droppedMisfit: 0,
  };

  const layouts = parsed.layouts.map((layout): FarmLayout => {
    const seen = new Set<string>();
    const withIds = layout.objects.map((o) => {
      const id = seen.has(o.id) ? newId() : o.id;
      seen.add(id);
      return id === o.id ? o : { ...o, id };
    });
    const withDefs = withIds.filter((o) => known.has(o.defId));
    report.droppedUnknown += withIds.length - withDefs.length;

    const probe: FarmLayout = { ...layout, objects: withDefs };
    const misfits = new Set(findMisfits(probe, merged));
    report.droppedMisfit += misfits.size;

    return { ...layout, id: newId(), objects: withDefs.filter((o) => !misfits.has(o.id)), updatedAt: now };
  });

  return { layouts, definitionsToAdd, report };
}
