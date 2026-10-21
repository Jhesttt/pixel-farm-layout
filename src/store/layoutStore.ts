import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  duplicatedObjects,
  findMisfits,
  nudgedObjects,
  rotateObjects as rotateInLayout,
} from "../lib/edit";
import { canPlace, clampGridSize, getObjectsOutsideSize } from "../lib/grid";
import { persistedLayoutsSchema } from "../lib/schemas";
import { createSafeStorage, envelopeValidator } from "../lib/storage";
import type { FarmLayout, ObjectDefinition, PlacedObject, ViewSettings } from "../types";

export const LAYOUTS_STORAGE_KEY = "pfl:layouts:v1";
const LAYOUTS_VERSION = 1;

/** The fields of a placed object a user edits in the inspector. */
export type ObjectPatch = Partial<Pick<PlacedObject, "label" | "colorOverride" | "showEffect">>;

export const DEFAULT_VIEW: ViewSettings = { showGrid: true, showLabels: true, showEffects: true };

interface LayoutState {
  layouts: Record<string, FarmLayout>;
  activeLayoutId: string | null;
  /** Ids of selected objects in the active layout. In memory only. */
  selection: string[];
  view: ViewSettings;
  setSelection: (ids: string[]) => void;
  /** Adds the id to the selection, or removes it if already selected. */
  toggleSelected: (id: string) => void;
  setView: (patch: Partial<ViewSettings>) => void;
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
  /** Deletes objects from the active layout and drops them from the selection. */
  removeObjects: (ids: string[]) => void;
  /**
   * Turns each object 90 degrees clockwise. One that would not fit is shifted back inside the grid,
   * and left alone if it still cannot fit.
   */
  rotateObjects: (ids: string[], defs: ObjectDefinition[]) => void;
  /** Shifts the objects together by whole cells; does nothing unless every one can move. */
  nudgeObjects: (ids: string[], dx: number, dy: number, defs: ObjectDefinition[]) => boolean;
  /** Edits label, colour override or the effect toggle. An empty label or undefined colour clears it. */
  updateObjects: (ids: string[], patch: ObjectPatch) => void;
  /** Copies the objects to the nearest free spot and selects the copies. Returns their ids. */
  duplicateObjects: (ids: string[], defs: ObjectDefinition[]) => string[];
  /** Removes every placement of a definition from every layout. Returns how many were removed. */
  removeObjectsByDef: (defId: string) => number;
  /**
   * After definitions change size, removes placements (in every layout) that no longer fit: out of
   * bounds, or overlapping an earlier object. Returns how many were removed.
   */
  removeMisfitObjects: (defs: ObjectDefinition[]) => number;
}

interface PersistedLayouts {
  layouts: Record<string, FarmLayout>;
  activeLayoutId: string | null;
  view: ViewSettings;
}

function mostRecentlyUpdatedId(layouts: Record<string, FarmLayout>): string | null {
  let best: FarmLayout | null = null;
  for (const layout of Object.values(layouts)) {
    if (best === null || layout.updatedAt > best.updatedAt) best = layout;
  }
  return best?.id ?? null;
}

/** `layout` with its objects replaced, and updatedAt bumped. */
function withObjects(layout: FarmLayout, objects: PlacedObject[]): FarmLayout {
  return { ...layout, objects, updatedAt: Date.now() };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => {
      /** Replaces the active layout's objects, optionally adjusting the selection too. */
      const commitObjects = (layout: FarmLayout, objects: PlacedObject[], selection?: string[]) =>
        set((s) => ({
          layouts: { ...s.layouts, [layout.id]: withObjects(layout, objects) },
          ...(selection ? { selection } : {}),
        }));

      return {
        layouts: {},
        activeLayoutId: null,
        selection: [],
        view: DEFAULT_VIEW,

        setSelection: (ids) => set({ selection: ids }),

        toggleSelected: (id) =>
          set((s) => ({
            selection: s.selection.includes(id)
              ? s.selection.filter((x) => x !== id)
              : [...s.selection, id],
          })),

        setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),

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
          set((s) => ({
            layouts: { ...s.layouts, [id]: layout },
            activeLayoutId: id,
            selection: [],
          }));
          return id;
        },

        setActiveLayout: (id) =>
          set((s) => (id in s.layouts ? { activeLayoutId: id, selection: [] } : s)),

        deleteLayout: (id) =>
          set((s) => {
            if (!(id in s.layouts)) return s;
            const { [id]: _removed, ...layouts } = s.layouts;
            const wasActive = s.activeLayoutId === id;
            return {
              layouts,
              activeLayoutId: wasActive ? mostRecentlyUpdatedId(layouts) : s.activeLayoutId,
              selection: wasActive ? [] : s.selection,
            };
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
            return {
              layouts: { ...s.layouts, [id]: resized },
              selection: s.selection.filter((sel) => !dropped.has(sel)),
            };
          }),

        placeObject: (object, defs) => {
          const layout = selectActiveLayout(get());
          if (!layout) return null;
          const placed: PlacedObject = { ...object, id: nanoid() };
          if (!canPlace(layout, defs, placed)) return null;
          commitObjects(layout, [...layout.objects, placed]);
          return placed.id;
        },

        moveObject: (id, x, y, defs, rotation) => {
          const layout = selectActiveLayout(get());
          const current = layout?.objects.find((o) => o.id === id);
          if (!layout || !current) return false;
          const moved: PlacedObject = { ...current, x, y, rotation: rotation ?? current.rotation };
          if (!canPlace(layout, defs, moved, [id])) return false;
          commitObjects(layout, layout.objects.map((o) => (o.id === id ? moved : o)));
          return true;
        },

        removeObjects: (ids) => {
          const layout = selectActiveLayout(get());
          if (!layout || !layout.objects.some((o) => ids.includes(o.id))) return;
          commitObjects(
            layout,
            layout.objects.filter((o) => !ids.includes(o.id)),
            get().selection.filter((sel) => !ids.includes(sel)),
          );
        },

        rotateObjects: (ids, defs) => {
          const layout = selectActiveLayout(get());
          if (!layout) return;
          const changed = rotateInLayout(layout, defs, ids);
          if (changed.length === 0) return;
          const byId = new Map(changed.map((o) => [o.id, o]));
          commitObjects(layout, layout.objects.map((o) => byId.get(o.id) ?? o));
        },

        nudgeObjects: (ids, dx, dy, defs) => {
          const layout = selectActiveLayout(get());
          if (!layout) return false;
          const moved = nudgedObjects(layout, defs, ids, dx, dy);
          if (!moved) return false;
          const byId = new Map(moved.map((o) => [o.id, o]));
          commitObjects(layout, layout.objects.map((o) => byId.get(o.id) ?? o));
          return true;
        },

        updateObjects: (ids, patch) => {
          const layout = selectActiveLayout(get());
          if (!layout || !layout.objects.some((o) => ids.includes(o.id))) return;
          commitObjects(
            layout,
            layout.objects.map((o) => {
              if (!ids.includes(o.id)) return o;
              const next: PlacedObject = { ...o, ...patch };
              if (!next.label) delete next.label;
              if (!next.colorOverride) delete next.colorOverride;
              return next;
            }),
          );
        },

        duplicateObjects: (ids, defs) => {
          const layout = selectActiveLayout(get());
          if (!layout) return [];
          const copies = duplicatedObjects(layout, defs, ids, nanoid);
          if (!copies) return [];
          const copyIds = copies.map((c) => c.id);
          commitObjects(layout, [...layout.objects, ...copies], copyIds);
          return copyIds;
        },

        removeObjectsByDef: (defId) => {
          let removed = 0;
          set((s) => {
            const removedIds = new Set<string>();
            const layouts = { ...s.layouts };
            for (const layout of Object.values(s.layouts)) {
              const doomed = layout.objects.filter((o) => o.defId === defId);
              if (doomed.length === 0) continue;
              doomed.forEach((o) => removedIds.add(o.id));
              removed += doomed.length;
              layouts[layout.id] = withObjects(
                layout,
                layout.objects.filter((o) => o.defId !== defId),
              );
            }
            if (removed === 0) return s;
            return { layouts, selection: s.selection.filter((id) => !removedIds.has(id)) };
          });
          return removed;
        },

        removeMisfitObjects: (defs) => {
          let removed = 0;
          set((s) => {
            const removedIds = new Set<string>();
            const layouts = { ...s.layouts };
            for (const layout of Object.values(s.layouts)) {
              const misfits = findMisfits(layout, defs);
              if (misfits.length === 0) continue;
              misfits.forEach((id) => removedIds.add(id));
              removed += misfits.length;
              layouts[layout.id] = withObjects(
                layout,
                layout.objects.filter((o) => !misfits.includes(o.id)),
              );
            }
            if (removed === 0) return s;
            return { layouts, selection: s.selection.filter((id) => !removedIds.has(id)) };
          });
          return removed;
        },
      };
    },
    {
      name: LAYOUTS_STORAGE_KEY,
      version: LAYOUTS_VERSION,
      storage: createJSONStorage(() =>
        createSafeStorage({ validate: envelopeValidator(persistedLayoutsSchema, LAYOUTS_VERSION) }),
      ),
      // selection and history stay in memory only
      partialize: (s): PersistedLayouts => ({
        layouts: s.layouts,
        activeLayoutId: s.activeLayoutId,
        view: s.view,
      }),
      // v1 is the first schema. Future versions: switch on `version` here and return the upgraded
      // state, so a schema change never wipes saved layouts.
      migrate: (persisted) => persisted as PersistedLayouts,
      // Guard against an active id that no longer points at a layout, and default `view` for
      // saves written before it existed.
      merge: (persisted, current) => {
        const saved = persisted as Partial<PersistedLayouts> | undefined;
        const layouts = saved?.layouts ?? {};
        const activeLayoutId =
          saved?.activeLayoutId && saved.activeLayoutId in layouts
            ? saved.activeLayoutId
            : mostRecentlyUpdatedId(layouts);
        return { ...current, layouts, activeLayoutId, view: { ...DEFAULT_VIEW, ...saved?.view } };
      },
    },
  ),
);

export function selectActiveLayout(s: LayoutState): FarmLayout | null {
  return s.activeLayoutId ? (s.layouts[s.activeLayoutId] ?? null) : null;
}
