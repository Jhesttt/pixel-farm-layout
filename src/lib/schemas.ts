import { z } from "zod";
import type {
  Cell,
  EffectDefinition,
  FarmLayout,
  ObjectDefinition,
  PlacedObject,
  ViewSettings,
} from "../types";

import { GRID_MAX_SIZE, GRID_MIN_SIZE } from "./grid";

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const cellCount = z.number().int().min(1).max(GRID_MAX_SIZE);

export const cellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

export const effectDefinitionSchema = z.object({
  width: cellCount,
  height: cellCount,
  offsetX: z.number().int(),
  offsetY: z.number().int(),
  color: hexColor,
  shape: z.enum(["rect", "circle", "custom"]).optional(),
  customCells: z.array(cellSchema).optional(),
});

export const objectDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: cellCount,
  height: cellCount,
  color: hexColor,
  icon: z.string().optional(),
  effect: effectDefinitionSchema.optional(),
  builtIn: z.boolean(),
});

export const placedObjectSchema = z.object({
  id: z.string().min(1),
  defId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  label: z.string().optional(),
  colorOverride: hexColor.optional(),
  showEffect: z.boolean(),
});

export const farmLayoutSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  width: z.number().int().min(GRID_MIN_SIZE).max(GRID_MAX_SIZE),
  height: z.number().int().min(GRID_MIN_SIZE).max(GRID_MAX_SIZE),
  objects: z.array(placedObjectSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.literal(1),
});

export const viewSettingsSchema = z.object({
  // Added after the first release of the view settings; older saves default to the top view.
  projection: z.enum(["top", "iso"]).default("top"),
  showGrid: z.boolean(),
  showLabels: z.boolean(),
  showEffects: z.boolean(),
});

// Shape of what zustand `persist` writes to LocalStorage.
export const persistedLayoutsSchema = z.object({
  state: z.object({
    layouts: z.record(z.string(), farmLayoutSchema),
    activeLayoutId: z.string().nullable(),
    // Added after the first release of schema v1; absent in older saves and defaulted on load.
    view: viewSettingsSchema.optional(),
  }),
  version: z.number(),
});

export const persistedLibrarySchema = z.object({
  state: z.object({ definitions: z.array(objectDefinitionSchema) }),
  version: z.number(),
});

// Compile-time guard: each schema must infer exactly the type in types.ts.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertSchemaMatchesType = <_T extends true>() => {};
assertSchemaMatchesType<Equal<z.infer<typeof cellSchema>, Cell>>();
assertSchemaMatchesType<Equal<z.infer<typeof effectDefinitionSchema>, EffectDefinition>>();
assertSchemaMatchesType<Equal<z.infer<typeof objectDefinitionSchema>, ObjectDefinition>>();
assertSchemaMatchesType<Equal<z.infer<typeof placedObjectSchema>, PlacedObject>>();
assertSchemaMatchesType<Equal<z.infer<typeof farmLayoutSchema>, FarmLayout>>();
assertSchemaMatchesType<Equal<z.infer<typeof viewSettingsSchema>, ViewSettings>>();
