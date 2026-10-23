import { afterEach, describe, expect, it } from "vitest";
import { persistedLayoutsSchema, viewSettingsSchema } from "../lib/schemas";
import { DEFAULT_VIEW, useLayoutStore } from "../store/layoutStore";

describe("projection setting", () => {
  afterEach(() => useLayoutStore.getState().setView({ projection: "top" }));

  it("defaults to the top view", () => {
    expect(DEFAULT_VIEW.projection).toBe("top");
    expect(useLayoutStore.getState().view.projection).toBe("top");
  });

  it("switches between top and isometric without touching the other toggles", () => {
    useLayoutStore.getState().setView({ showLabels: false });
    useLayoutStore.getState().setView({ projection: "iso" });
    expect(useLayoutStore.getState().view).toMatchObject({ projection: "iso", showLabels: false });
    useLayoutStore.getState().setView({ projection: "top", showLabels: true });
    expect(useLayoutStore.getState().view).toMatchObject({ projection: "top", showLabels: true });
  });

  it("is accepted by the storage schema, defaulting for saves from before it existed", () => {
    const old = { showGrid: true, showLabels: true, showEffects: false };
    expect(viewSettingsSchema.parse(old)).toEqual({ ...old, projection: "top" });
    expect(viewSettingsSchema.safeParse({ ...old, projection: "iso" }).success).toBe(true);
    expect(viewSettingsSchema.safeParse({ ...old, projection: "sideways" }).success).toBe(false);
  });

  it("does not reject a whole saved file just because its view predates the setting", () => {
    const saved = {
      state: { layouts: {}, activeLayoutId: null, view: { showGrid: true, showLabels: true, showEffects: true } },
      version: 1,
    };
    expect(persistedLayoutsSchema.safeParse(saved).success).toBe(true);
  });

  it("restores a saved isometric choice, and fills in the top view for an old save", () => {
    const merge = useLayoutStore.persist.getOptions().merge!;
    const current = useLayoutStore.getState();
    const withIso = merge({ layouts: {}, activeLayoutId: null, view: { projection: "iso", showGrid: true, showLabels: true, showEffects: true } }, current);
    expect((withIso as typeof current).view.projection).toBe("iso");
    const old = merge({ layouts: {}, activeLayoutId: null, view: { showGrid: false, showLabels: true, showEffects: true } }, current);
    expect((old as typeof current).view).toMatchObject({ projection: "top", showGrid: false });
    const none = merge({ layouts: {}, activeLayoutId: null }, current);
    expect((none as typeof current).view).toEqual(DEFAULT_VIEW);
  });
});
