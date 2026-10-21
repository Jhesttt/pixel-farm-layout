import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createSafeStorage,
  envelopeValidator,
  onStorageError,
  type BackingStore,
  type StorageErrorEvent,
} from "../lib/storage";

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const backing: BackingStore & { data: Map<string, string> } = {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: (k) => void data.delete(k),
  };
  return backing;
}

const schema = z.object({ state: z.object({ n: z.number() }), version: z.number() });
const validate = envelopeValidator(schema, 1);
const good = JSON.stringify({ state: { n: 1 }, version: 1 });

let events: StorageErrorEvent[];
let unsubscribe: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  events = [];
  unsubscribe = onStorageError((e) => events.push(e));
});

afterEach(() => {
  unsubscribe();
  vi.useRealTimers();
});

describe("envelopeValidator", () => {
  it("applies the strict schema at the current version", () => {
    expect(validate({ state: { n: 1 }, version: 1 })).toBe(true);
    expect(validate({ state: { n: "x" }, version: 1 })).toBe(false);
    expect(validate({ state: {} })).toBe(false);
  });

  it("only checks structure for other versions so migrate can run", () => {
    expect(validate({ state: { anything: true }, version: 0 })).toBe(true);
    expect(validate({ version: 0 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validate(null)).toBe(false);
    expect(validate("str")).toBe(false);
  });
});

describe("createSafeStorage reads", () => {
  it("returns null when nothing is stored", () => {
    const storage = createSafeStorage({ validate, backing: () => fakeBacking() });
    expect(storage.getItem("k")).toBeNull();
  });

  it("returns valid stored data untouched", () => {
    const storage = createSafeStorage({ validate, backing: () => fakeBacking({ k: good }) });
    expect(storage.getItem("k")).toBe(good);
    expect(events).toEqual([]);
  });

  it.each([
    ["unparseable JSON", "{not json"],
    ["schema mismatch", JSON.stringify({ state: { n: "oops" }, version: 1 })],
  ])("backs up %s to pfl:corrupt:<timestamp> and starts fresh", (_label, raw) => {
    vi.setSystemTime(1_700_000_000_000);
    const backing = fakeBacking({ k: raw });
    const storage = createSafeStorage({ validate, backing: () => backing });

    expect(storage.getItem("k")).toBeNull();
    expect(backing.data.has("k")).toBe(false);
    expect(backing.data.get("pfl:corrupt:1700000000000")).toBe(raw);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("corrupt");
  });

  it("does not overwrite an earlier backup made in the same millisecond", () => {
    vi.setSystemTime(1_700_000_000_000);
    const backing = fakeBacking({ a: "bad-a", b: "bad-b" });
    const storage = createSafeStorage({ validate, backing: () => backing });
    storage.getItem("a");
    storage.getItem("b");
    const backups = [...backing.data.entries()].filter(([k]) => k.startsWith("pfl:corrupt:"));
    expect(backups.map(([, v]) => v).sort()).toEqual(["bad-a", "bad-b"]);
  });

  it("returns a queued write instead of stale stored data", () => {
    const backing = fakeBacking({ k: good });
    const storage = createSafeStorage({ validate, backing: () => backing });
    const next = JSON.stringify({ state: { n: 2 }, version: 1 });
    storage.setItem("k", next);
    expect(storage.getItem("k")).toBe(next);
  });
});

describe("createSafeStorage writes", () => {
  it("debounces: only the last value is written, after the delay", () => {
    const backing = fakeBacking();
    const storage = createSafeStorage({ validate, backing: () => backing, debounceMs: 300 });
    storage.setItem("k", "1");
    vi.advanceTimersByTime(200);
    storage.setItem("k", "2");
    vi.advanceTimersByTime(200);
    expect(backing.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(backing.setItem).toHaveBeenCalledTimes(1);
    expect(backing.data.get("k")).toBe("2");
  });

  it("debounces each key independently", () => {
    const backing = fakeBacking();
    const storage = createSafeStorage({ validate, backing: () => backing });
    storage.setItem("a", "1");
    storage.setItem("b", "2");
    vi.advanceTimersByTime(300);
    expect(backing.data.get("a")).toBe("1");
    expect(backing.data.get("b")).toBe("2");
  });

  it("reports QuotaExceededError instead of throwing", () => {
    const backing = fakeBacking();
    backing.setItem = () => {
      const err = new Error("full");
      err.name = "QuotaExceededError";
      throw err;
    };
    const storage = createSafeStorage({ validate, backing: () => backing });
    storage.setItem("k", "v");
    expect(() => vi.advanceTimersByTime(300)).not.toThrow();
    expect(events).toEqual([{ kind: "quota", key: "k", message: "full" }]);
  });

  it("reports other write failures as unknown", () => {
    const backing = fakeBacking();
    backing.setItem = () => {
      throw new Error("denied");
    };
    const storage = createSafeStorage({ validate, backing: () => backing });
    storage.setItem("k", "v");
    vi.advanceTimersByTime(300);
    expect(events[0]?.kind).toBe("unknown");
  });

  it("removeItem cancels a pending write", () => {
    const backing = fakeBacking({ k: good });
    const storage = createSafeStorage({ validate, backing: () => backing });
    storage.setItem("k", "queued");
    storage.removeItem("k");
    vi.advanceTimersByTime(1000);
    expect(backing.data.has("k")).toBe(false);
  });
});

describe("onStorageError", () => {
  it("delivers events raised before anyone subscribed to the first subscriber only", () => {
    unsubscribe(); // drop the subscription made in beforeEach so nothing is listening
    const backing = fakeBacking({ k: "{bad" });
    createSafeStorage({ validate, backing: () => backing }).getItem("k");

    const late: StorageErrorEvent[] = [];
    const stop = onStorageError((e) => late.push(e));
    expect(late.map((e) => e.kind)).toEqual(["corrupt"]);
    stop();

    const second: StorageErrorEvent[] = [];
    onStorageError((e) => second.push(e))();
    expect(second).toEqual([]);
    unsubscribe = () => {};
  });
});
