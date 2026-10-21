import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { canPlace, clampGridSize, getObjectsOutsideSize } from "../lib/grid";
import { persistedLayoutsSchema } from "../lib/schemas";
import { createSafeStorage, envelopeValidator } from "../lib/storage";
import type { FarmLayout, ObjectDefinition, PlacedObject } from "../types";

export const LAYOUTS_STORAGE_KEY = "pfl:layouts:v1";
const LAYOUTS_VERSION = 1;

interface LayoutState {
  layouts: Record<string, FarmLayout>;
  activeLayoutId: string | null;
  /** Creates a layout, makes it active, and returns its id. */
  createLayout: (name: string, width: number, height: number) => string;
  setActiveLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, name: string) => void;
  /**
   * Objects whose footprint falls outside the new size are dropped, so callers should confirm
   * first (see `getObjectsOutsideSize`). `defs` supplies the footprints.
   */
  resizeLayout: (id: string, width: number, height: number, defs: ObjectDefinition[]) => void;
  /**
   * Adds an object to the active layout if `canPlace` allows it. Returns the new id, or null when
   * it does not fit (nothing changes).
   */
  placeObject: (object: Omit<PlacedObject, "id">, defs: ObjectDefinition[]) => string | null;
  /**
   * Moves (and optionally rotates) an object in the active layout if the new spot is valid, with
   * the object itself ignored in the collision check. Returns whether it moved.
   */
  moveObject: (
    id: string,
    x: number,
    y: number,
    defs: ObjectDefinition[],
    rotation?: PlacedObject["rotation"],
  ) => boolean;
}

interface PersistedLayouts {
  layouts: Record<string, FarmLayout>;
  activeLayoutId: string | null;
}

function mostRecentlyUpdatedId(layouts: Record<string, FarmLayout>): string | null {
  let best: FarmLayout | null = null;
  for (const layout of Object.values(layouts)) {
    if (best === null || layout.updatedAt > best.updatedAt) best = layout;
  }
  return best?.id ?? null;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      layouts: {},
      activeLayoutId: null,

      createLayout: (name, width, height) => {
        const id = nanoid();
        const now = Date.now();
        const layout: FarmLayout = {
          id,
          name: name.trim() || "Untitled",
          width: clampGridSize(width),
          height: clampGridSize(height),
          objects: [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        };
        set((s) => ({ layouts: { ...s.layouts, [id]: layout }, activeLayoutId: id }));
        return id;
      },

      setActiveLayout: (id) =>
        set((s) => (id in s.layouts ? { activeLayoutId: id } : s)),

      deleteLayout: (id) =>
        set((s) => {
          if (!(id in s.layouts)) return s;
          const { [id]: _removed, ...layouts } = s.layouts;
          const activeLayoutId =
            s.activeLayoutId === id ? mostRecentlyUpdatedId(layouts) : s.activeLayoutId;
          return { layouts, activeLayoutId };
        }),

      renameLayout: (id, name) =>
        set((s) => {
          const layout = s.layouts[id];
          const trimmed = name.trim();
          if (!layout || !trimmed || trimmed === layout.name) return s;
          return {
            layouts: { ...s.layouts, [id]: { ...layout, name: trimmed, updatedAt: Date.now() } },
          };
        }),

      resizeLayout: (id, width, height, defs) =>
        set((s) => {
          const layout = s.layouts[id];
          if (!layout) return s;
          const w = clampGridSize(width);
          const h = clampGridSize(height);
          if (w === layout.width && h === layout.height) return s;
          const dropped = new Set(getObjectsOutsideSize(layout, defs, w, h).map((o) => o.id));
          const resized: FarmLayout = {
            ...layout,
            width: w,
            height: h,
            objects: layout.objects.filter((o) => !dropped.has(o.id)),
            updatedAt: Date.now(),
          };
          return { layouts: { ...s.layouts, [id]: resized } };
        }),

      placeObject: (object, defs) => {
        const layout = selectActiveLayout(get());
        if (!layout) return null;
        const placed: PlacedObject = { ...object, id: nanoid() };
        if (!canPlace(layout, defs, placed)) return null;
        set((s) => ({
          layouts: {
            ...s.layouts,
            [layout.id]: { ...layout, objects: [...layout.objects, placed], updatedAt: Date.now() },
          },
        }));
        return placed.id;
      },

      moveObject: (id, x, y, defs, rotation) => {
        const layout = selectActiveLayout(get());
        const current = layout?.objects.find((o) => o.id === id);
        if (!layout || !current) return false;
        const moved: PlacedObject = { ...current, x, y, rotation: rotation ?? current.rotation };
        if (!canPlace(layout, defs, moved, [id])) return false;
        set((s) => ({
          layouts: {
            ...s.layouts,
            [layout.id]: {
              ...layout,
              objects: layout.objects.map((o) => (o.id === id ? moved : o)),
              updatedAt: Date.now(),
            },
          },
        }));
        return true;
      },
    }),
    {
      name: LAYOUTS_STORAGE_KEY,
      version: LAYOUTS_VERSION,
      storage: createJSONStorage(() =>
        createSafeStorage({ validate: envelopeValidator(persistedLayoutsSchema, LAYOUTS_VERSION) }),
      ),
      // selection and history (later steps) stay in memory only
      partialize: (s): PersistedLayouts => ({
        layouts: s.layouts,
        activeLayoutId: s.activeLayoutId,
      }),
      // v1 is the first schema. Future versions: switch on `version` here and return the upgraded
      // state, so a schema change never wipes saved layouts.
      migrate: (persisted) => persisted as PersistedLayouts,
      // Guard against an active id that no longer points at a layout.
      merge: (persisted, current) => {
        const saved = persisted as Partial<PersistedLayouts> | undefined;
        const layouts = saved?.layouts ?? {};
        const activeLayoutId =
          saved?.activeLayoutId && saved.activeLayoutId in layouts
            ? saved.activeLayoutId
            : mostRecentlyUpdatedId(layouts);
        return { ...current, layouts, activeLayoutId };
      },
    },
  ),
);

export function selectActiveLayout(s: LayoutState): FarmLayout | null {
  return s.activeLayoutId ? (s.layouts[s.activeLayoutId] ?? null) : null;
}
