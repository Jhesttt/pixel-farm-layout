import type { StateStorage } from "zustand/middleware";
import type { z } from "zod";

// The only module (with the persist config in the stores) that touches LocalStorage.

export interface BackingStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageErrorKind = "quota" | "corrupt" | "unknown";

export interface StorageErrorEvent {
  kind: StorageErrorKind;
  key: string;
  message: string;
}

const CORRUPT_PREFIX = "pfl:corrupt:";
const DEFAULT_DEBOUNCE_MS = 300;

const errorListeners = new Set<(event: StorageErrorEvent) => void>();
// Stores load at import time, before any UI can subscribe, so events with no listener wait here.
const undelivered: StorageErrorEvent[] = [];
const MAX_UNDELIVERED = 10;

/**
 * Subscribe to storage problems (quota exceeded, corrupt data backed up). Events raised while
 * nobody was subscribed are delivered to the first subscriber. Returns unsubscribe.
 */
export function onStorageError(listener: (event: StorageErrorEvent) => void): () => void {
  errorListeners.add(listener);
  for (const event of undelivered.splice(0)) listener(event);
  return () => {
    errorListeners.delete(listener);
  };
}

function emit(event: StorageErrorEvent): void {
  if (errorListeners.size === 0) {
    undelivered.push(event);
    if (undelivered.length > MAX_UNDELIVERED) undelivered.shift();
    return;
  }
  for (const listener of errorListeners) listener(event);
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function memoryStore(): BackingStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** window.localStorage if it is usable, otherwise an in-memory store (private mode, tests, SSR). */
function defaultBacking(): BackingStore {
  try {
    const probe = "pfl:probe";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return memoryStore();
  }
}

/**
 * Validator for zustand's persisted envelope `{ state, version }`. The strict schema is applied
 * only when the stored version is the current one; older versions are structurally checked and
 * left to the store's `migrate`.
 */
export function envelopeValidator(
  schema: z.ZodType,
  currentVersion: number,
): (parsed: unknown) => boolean {
  return (parsed) => {
    if (typeof parsed !== "object" || parsed === null) return false;
    const envelope = parsed as { state?: unknown; version?: unknown };
    if (typeof envelope.version === "number" && envelope.version !== currentVersion) {
      return typeof envelope.state === "object" && envelope.state !== null;
    }
    return schema.safeParse(parsed).success;
  };
}

interface SafeStorageOptions {
  /** Called with the parsed stored value; false means it is corrupt. */
  validate: (parsed: unknown) => boolean;
  debounceMs?: number;
  backing?: () => BackingStore;
}

/**
 * A zustand `StateStorage` that
 * - debounces writes (every drag commit triggers a save) and flushes them when the page hides,
 * - reports QuotaExceededError through `onStorageError` instead of throwing,
 * - on load, backs corrupt data up to `pfl:corrupt:<timestamp>` and starts fresh.
 */
export function createSafeStorage(options: SafeStorageOptions): StateStorage {
  const { validate, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  let backing: BackingStore | undefined;
  const store = (): BackingStore => (backing ??= (options.backing ?? defaultBacking)());

  const pending = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function flush(key: string): void {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);

    const value = pending.get(key);
    if (value === undefined) return;
    pending.delete(key);
    try {
      store().setItem(key, value);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ kind: isQuotaError(err) ? "quota" : "unknown", key, message });
    }
  }

  function flushAll(): void {
    for (const key of [...pending.keys()]) flush(key);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });
  }

  function backupCorrupt(raw: string): void {
    let backupKey = `${CORRUPT_PREFIX}${Date.now()}`;
    for (let n = 1; store().getItem(backupKey) !== null; n++) {
      backupKey = `${CORRUPT_PREFIX}${Date.now()}-${n}`;
    }
    try {
      store().setItem(backupKey, raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ kind: isQuotaError(err) ? "quota" : "unknown", key: backupKey, message });
    }
  }

  return {
    getItem(key) {
      const queued = pending.get(key);
      if (queued !== undefined) return queued;

      const raw = store().getItem(key);
      if (raw === null) return null;

      let valid = false;
      try {
        valid = validate(JSON.parse(raw));
      } catch {
        valid = false;
      }
      if (valid) return raw;

      backupCorrupt(raw);
      store().removeItem(key);
      emit({
        kind: "corrupt",
        key,
        message: `Saved data for "${key}" was unreadable and has been backed up.`,
      });
      return null;
    },

    setItem(key, value) {
      pending.set(key, value);
      const existing = timers.get(key);
      if (existing !== undefined) clearTimeout(existing);
      timers.set(key, setTimeout(() => flush(key), debounceMs));
    },

    removeItem(key) {
      const timer = timers.get(key);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(key);
      pending.delete(key);
      store().removeItem(key);
    },
  };
}
