import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS as defs } from "../data/builtIns";
import {
  EXPORT_FORMAT,
  MAX_IMPORT_BYTES,
  buildExport,
  parseImport,
  prepareImport,
  serializeExport,
} from "../lib/exchange";
import { exportFileName, formatUpdated } from "../lib/format";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

const obj = (id: string, defId: string, x: number, y: number): PlacedObject => ({
  id, defId, x, y, rotation: 0, showEffect: true,
});

const layout = (id: string, objects: PlacedObject[], size = 8): FarmLayout => ({
  id, name: `Layout ${id}`, width: size, height: size, objects, createdAt: 100, updatedAt: 200, schemaVersion: 1,
});

const shed: ObjectDefinition = { id: "custom-shed", name: "Shed", width: 3, height: 2, color: "#112233", builtIn: false };

let counter = 0;
const newId = () => `new-${counter++}`;

describe("buildExport", () => {
  it("includes only the definitions the layouts use", () => {
    const l = layout("a", [obj("1", "builtin-crop", 0, 0), obj("2", "custom-shed", 2, 2)]);
    const env = buildExport([l], [...defs, shed], 999);
    expect(env.definitions.map((d) => d.id).sort()).toEqual(["builtin-crop", "custom-shed"]);
    expect(env).toMatchObject({ app: "pixel-farm-layout", format: EXPORT_FORMAT, exportedAt: 999 });
  });

  it("has no definitions for an empty layout", () => {
    expect(buildExport([layout("a", [])], defs, 1).definitions).toEqual([]);
  });
});

describe("parseImport", () => {
  const roundTrip = (layouts: FarmLayout[], d: ObjectDefinition[] = defs) =>
    parseImport(serializeExport(buildExport(layouts, d, 1)));

  it("round-trips layouts and their definitions", () => {
    const l = layout("a", [obj("1", "custom-shed", 1, 1)]);
    const result = roundTrip([l], [...defs, shed]);
    expect(result).toEqual({ ok: true, value: { layouts: [l], definitions: [shed] } });
  });

  it("reads several layouts (export all)", () => {
    const result = roundTrip([layout("a", []), layout("b", [])]);
    expect(result.ok && result.value.layouts.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("accepts a bare layout with no definitions", () => {
    const l = layout("a", [obj("1", "builtin-crop", 0, 0)]);
    expect(parseImport(JSON.stringify(l))).toEqual({ ok: true, value: { layouts: [l], definitions: [] } });
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["a number", "42", /not a Pixel Farm layout export/],
    ["another app's file", JSON.stringify({ app: "other", format: 1, layouts: [], definitions: [] }), /not a Pixel Farm/],
    ["no layouts", JSON.stringify({ app: "pixel-farm-layout", format: 1, exportedAt: 1, layouts: [], definitions: [] }), /not a Pixel Farm/],
  ])("rejects %s with a readable message", (_label, text, message) => {
    const result = parseImport(text);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });

  it("rejects an out-of-range grid size and says where", () => {
    const bad = { ...layout("a", []), width: 500 };
    const result = parseImport(JSON.stringify({ app: "pixel-farm-layout", format: 1, exportedAt: 1, layouts: [bad], definitions: [] }));
    expect(!result.ok && result.error).toMatch(/layouts\.0\.width/);
  });

  it("rejects an object with an invalid rotation", () => {
    const l = layout("a", [{ ...obj("1", "builtin-crop", 0, 0), rotation: 45 as 0 }]);
    expect(roundTrip([l]).ok).toBe(false);
  });

  it("rejects files from a newer format version", () => {
    const env = { ...buildExport([layout("a", [])], defs, 1), format: EXPORT_FORMAT + 1 };
    const result = parseImport(JSON.stringify(env));
    expect(!result.ok && result.error).toMatch(/newer version/);
  });

  it("rejects oversized input without parsing it", () => {
    const result = parseImport(" ".repeat(MAX_IMPORT_BYTES + 1));
    expect(!result.ok && result.error).toMatch(/too large/);
  });
});

describe("prepareImport", () => {
  const run = (layouts: FarmLayout[], fileDefs: ObjectDefinition[], existing = defs) => {
    counter = 0;
    return prepareImport({ layouts, definitions: fileDefs }, existing, newId, 5000);
  };

  it("gives imported layouts fresh ids and a new updatedAt, keeping name and createdAt", () => {
    const { layouts } = run([layout("a", [])], []);
    expect(layouts[0]).toMatchObject({ id: "new-0", name: "Layout a", createdAt: 100, updatedAt: 5000 });
  });

  it("adds definitions that are new and keeps local ones that already exist", () => {
    const localCrop = { ...defs[0]!, color: "#000000" };
    const fileCrop = { ...defs[0]!, color: "#ffffff" };
    const { definitionsToAdd, report } = run([layout("a", [])], [fileCrop, shed], [localCrop, ...defs.slice(1)]);
    expect(definitionsToAdd).toEqual([shed]);
    expect(report).toMatchObject({ addedDefinitions: 1, keptDefinitions: 1 });
  });

  it("keeps objects of newly added definitions", () => {
    const { layouts, report } = run([layout("a", [obj("1", "custom-shed", 0, 0)])], [shed]);
    expect(layouts[0]?.objects).toHaveLength(1);
    expect(report.droppedUnknown).toBe(0);
  });

  it("drops objects whose definition is unknown", () => {
    const { layouts, report } = run([layout("a", [obj("1", "custom-shed", 0, 0), obj("2", "builtin-crop", 5, 5)])], []);
    expect(layouts[0]?.objects.map((o) => o.id)).toEqual(["2"]);
    expect(report.droppedUnknown).toBe(1);
  });

  it("drops objects that are out of bounds or overlap an earlier one", () => {
    const l = layout("a", [
      obj("1", "builtin-crop", 0, 0),
      obj("2", "builtin-crop", 0, 0), // overlaps 1
      obj("3", "builtin-crop", 9, 9), // outside 8x8
      obj("4", "builtin-crop", 3, 3),
    ]);
    const { layouts, report } = run([l], []);
    expect(layouts[0]?.objects.map((o) => o.id)).toEqual(["1", "4"]);
    expect(report.droppedMisfit).toBe(2);
  });

  it("repairs duplicate object ids within a layout", () => {
    const l = layout("a", [obj("same", "builtin-crop", 0, 0), obj("same", "builtin-crop", 2, 2)]);
    const { layouts } = run([l], []);
    const ids = layouts[0]!.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("totals drops across several layouts", () => {
    const bad = (id: string) => layout(id, [obj("1", "builtin-crop", 99, 0)]);
    const { report } = run([bad("a"), bad("b")], []);
    expect(report.droppedMisfit).toBe(2);
  });
});

describe("formatUpdated", () => {
  const now = Date.UTC(2026, 9, 22, 12, 0, 0);
  it.each([
    [0, "just now"],
    [30_000, "just now"],
    [5 * 60_000, "5 minutes ago"],
    [60_000, "1 minute ago"],
    [3 * 3_600_000, "3 hours ago"],
    [24 * 3_600_000, "yesterday"],
    [3 * 24 * 3_600_000, "3 days ago"],
  ])("%d ms ago reads %j", (elapsed, text) => {
    expect(formatUpdated(now - elapsed, now)).toBe(text);
  });

  it("shows a date after a week", () => {
    expect(formatUpdated(now - 10 * 24 * 3_600_000, now)).toMatch(/Oct 12, 2026/);
  });

  it("treats a timestamp in the future as just now", () => {
    expect(formatUpdated(now + 5000, now)).toBe("just now");
  });
});

describe("exportFileName", () => {
  it("includes the grid size and extension", () => {
    expect(exportFileName("Home Farm", 17, 15, "json")).toBe("Home Farm-17x15.json");
  });

  it("strips characters that are not allowed in file names", () => {
    expect(exportFileName('a/b\\c:d*e?f"g<h>i|j', 8, 8, "png")).toBe("abcdefghij-8x8.png");
  });

  it("falls back to a default name and collapses whitespace", () => {
    expect(exportFileName("///", 8, 8, "json")).toBe("layout-8x8.json");
    expect(exportFileName("  my   farm ", 8, 8, "json")).toBe("my farm-8x8.json");
  });
});
