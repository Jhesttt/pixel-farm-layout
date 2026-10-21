import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BUILT_IN_DEFINITIONS, RETIRED_BUILTIN_IDS, withBuiltInsReset } from "../data/builtIns";
import { persistedLibrarySchema } from "../lib/schemas";
import { createSafeStorage, envelopeValidator } from "../lib/storage";
import type { ObjectDefinition } from "../types";

export const LIBRARY_STORAGE_KEY = "pfl:library:v1";
export const LIBRARY_VERSION = 2;

type NewDefinition = Omit<ObjectDefinition, "id" | "builtIn">;

interface LibraryState {
  definitions: ObjectDefinition[];
  addDefinition: (def: NewDefinition) => string;
  updateDefinition: (id: string, patch: Partial<Omit<ObjectDefinition, "id" | "builtIn">>) => void;
  /** Removes only the definition. Callers must warn about, and remove, placements that use it. */
  deleteDefinition: (id: string) => void;
  /** Restores every built-in to its seed values (re-adding deleted ones); custom definitions stay. */
  resetBuiltIns: () => void;
  /**
   * Adds definitions (from an imported file) whose ids are not already here; existing ones are kept.
   * Only genuine built-in ids stay marked built-in. Returns how many were added.
   */
  mergeDefinitions: (incoming: ObjectDefinition[]) => number;
}

interface PersistedLibrary {
  definitions: ObjectDefinition[];
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      definitions: BUILT_IN_DEFINITIONS,

      addDefinition: (def) => {
        const id = nanoid();
        set((s) => ({ definitions: [...s.definitions, { ...def, id, builtIn: false }] }));
        return id;
      },

      updateDefinition: (id, patch) =>
        set((s) => ({
          definitions: s.definitions.map((d) => {
            if (d.id !== id) return d;
            const next = { ...d, ...patch };
            // An explicit undefined clears an optional field rather than leaving the key behind.
            if (next.icon === undefined) delete next.icon;
            if (next.effect === undefined) delete next.effect;
            return next;
          }),
        })),

      deleteDefinition: (id) =>
        set((s) => ({ definitions: s.definitions.filter((d) => d.id !== id) })),

      resetBuiltIns: () => set((s) => ({ definitions: withBuiltInsReset(s.definitions) })),

      mergeDefinitions: (incoming) => {
        const have = new Set(get().definitions.map((d) => d.id));
        const fresh = incoming
          .filter((d) => !have.has(d.id))
          .map((d) => ({ ...d, builtIn: BUILT_IN_DEFINITIONS.some((b) => b.id === d.id) }));
        if (fresh.length > 0) set((s) => ({ definitions: [...s.definitions, ...fresh] }));
        return fresh.length;
      },
    }),
    {
      name: LIBRARY_STORAGE_KEY,
      version: LIBRARY_VERSION,
      storage: createJSONStorage(() =>
        createSafeStorage({ validate: envelopeValidator(persistedLibrarySchema, LIBRARY_VERSION) }),
      ),
      partialize: (s): PersistedLibrary => ({ definitions: s.definitions }),
      // Future versions: add a step here so a change never wipes saved definitions.
      migrate: (persisted, version) => {
        const saved = persisted as PersistedLibrary;
        if (version < 2) {
          // v2 changed the built-in set: drop the retired ones and bring the rest to their new seed
          // values. Custom definitions are kept as they are.
          const kept = saved.definitions.filter((d) => !(RETIRED_BUILTIN_IDS as readonly string[]).includes(d.id));
          return { definitions: withBuiltInsReset(kept) };
        }
        return saved;
      },
    },
  ),
);
