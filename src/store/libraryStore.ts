import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BUILT_IN_DEFINITIONS } from "../data/builtIns";
import { persistedLibrarySchema } from "../lib/schemas";
import { createSafeStorage, envelopeValidator } from "../lib/storage";
import type { ObjectDefinition } from "../types";

export const LIBRARY_STORAGE_KEY = "pfl:library:v1";
const LIBRARY_VERSION = 1;

type NewDefinition = Omit<ObjectDefinition, "id" | "builtIn">;

interface LibraryState {
  definitions: ObjectDefinition[];
  addDefinition: (def: NewDefinition) => string;
  updateDefinition: (id: string, patch: Partial<Omit<ObjectDefinition, "id" | "builtIn">>) => void;
  /** Removes only the definition. Callers must warn about, and remove, placements that use it. */
  deleteDefinition: (id: string) => void;
  /** Restores every built-in to its seed values (re-adding deleted ones); custom definitions stay. */
  resetBuiltIns: () => void;
}

interface PersistedLibrary {
  definitions: ObjectDefinition[];
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      definitions: BUILT_IN_DEFINITIONS,

      addDefinition: (def) => {
        const id = nanoid();
        set((s) => ({ definitions: [...s.definitions, { ...def, id, builtIn: false }] }));
        return id;
      },

      updateDefinition: (id, patch) =>
        set((s) => ({
          definitions: s.definitions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),

      deleteDefinition: (id) =>
        set((s) => ({ definitions: s.definitions.filter((d) => d.id !== id) })),

      resetBuiltIns: () =>
        set((s) => ({
          definitions: [
            ...BUILT_IN_DEFINITIONS,
            ...s.definitions.filter((d) => !BUILT_IN_DEFINITIONS.some((b) => b.id === d.id)),
          ],
        })),
    }),
    {
      name: LIBRARY_STORAGE_KEY,
      version: LIBRARY_VERSION,
      storage: createJSONStorage(() =>
        createSafeStorage({ validate: envelopeValidator(persistedLibrarySchema, LIBRARY_VERSION) }),
      ),
      partialize: (s): PersistedLibrary => ({ definitions: s.definitions }),
      // v1 is the first schema. Future versions: switch on `version` here and return the upgraded
      // state, so a schema change never wipes saved definitions.
      migrate: (persisted) => persisted as PersistedLibrary,
    },
  ),
);
