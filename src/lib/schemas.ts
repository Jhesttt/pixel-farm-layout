import { z } from "zod";
import type {
  Cell,
  EffectDefinition,
  FarmLayout,
  ObjectDefinition,
  PlacedObject,
} from "../types";

export const MIN_GRID_SIZE = 4;
export const MAX_GRID_SIZE = 64;

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const cellCount = z.number().int().min(1).max(MAX_GRID_SIZE);

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
  width: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE),
  height: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE),
  objects: z.array(placedObjectSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.literal(1),
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
