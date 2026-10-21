import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS as defs } from "../data/builtIns";
import {
  emptyForm,
  formFromDefinition,
  parseDefinitionForm,
  withCenteredOffsets,
  type DefinitionForm,
} from "../lib/definitionForm";
import { objectDefinitionSchema } from "../lib/schemas";

const valid = (patch: Partial<DefinitionForm> = {}): DefinitionForm => ({
  ...emptyForm(),
  name: "Shed",
  width: "3",
  height: "2",
  ...patch,
});

const errorsOf = (form: DefinitionForm) => {
  const result = parseDefinitionForm(form);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
};

describe("parseDefinitionForm", () => {
  it("builds a definition from a valid form, trimming the name", () => {
    const result = parseDefinitionForm(valid({ name: "  Shed  ", icon: " 🏚 " }));
    expect(result).toEqual({
      ok: true,
      value: { name: "Shed", width: 3, height: 2, color: "#8fb07e", icon: "🏚" },
    });
  });

  it("omits icon and effect when empty or off", () => {
    const result = parseDefinitionForm(valid());
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).not.toHaveProperty("icon");
    expect(result.value).not.toHaveProperty("effect");
  });

  it("includes a rect effect when enabled", () => {
    const result = parseDefinitionForm(
      valid({ hasEffect: true, effectWidth: "7", effectHeight: "5", offsetX: "-2", offsetY: "0", effectColor: "#112233" }),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.value.effect).toEqual({
      width: 7, height: 5, offsetX: -2, offsetY: 0, color: "#112233", shape: "rect",
    });
  });

  it("produces definitions the storage schema accepts", () => {
    const result = parseDefinitionForm(valid({ hasEffect: true, icon: "🌾" }));
    if (!result.ok) throw new Error("expected ok");
    expect(objectDefinitionSchema.safeParse({ ...result.value, id: "x", builtIn: false }).success).toBe(true);
  });

  it("requires a name and caps its length", () => {
    expect(errorsOf(valid({ name: "   " })).name).toBeDefined();
    expect(errorsOf(valid({ name: "x".repeat(31) })).name).toBeDefined();
    expect(parseDefinitionForm(valid({ name: "x".repeat(30) })).ok).toBe(true);
  });

  it.each(["", "0", "-1", "65", "2.5", "abc", "1e1"])("rejects footprint size %j", (bad) => {
    expect(errorsOf(valid({ width: bad })).width).toBeDefined();
    expect(errorsOf(valid({ height: bad })).height).toBeDefined();
  });

  it("accepts the size limits", () => {
    expect(parseDefinitionForm(valid({ width: "1", height: "64" })).ok).toBe(true);
  });

  it("rejects a bad colour", () => {
    expect(errorsOf(valid({ color: "red" })).color).toBeDefined();
    expect(errorsOf(valid({ color: "#fff" })).color).toBeDefined();
  });

  it("limits the icon to two symbols, counting an emoji as one", () => {
    expect(parseDefinitionForm(valid({ icon: "🌱🌳" })).ok).toBe(true);
    expect(parseDefinitionForm(valid({ icon: "👩‍🌾" })).ok).toBe(true);
    expect(errorsOf(valid({ icon: "abc" })).icon).toBeDefined();
  });

  it("validates effect fields only when the effect is on", () => {
    expect(parseDefinitionForm(valid({ effectWidth: "nope" })).ok).toBe(true);
    const errors = errorsOf(valid({ hasEffect: true, effectWidth: "0", offsetX: "99", effectColor: "x" }));
    expect(errors.effectWidth).toBeDefined();
    expect(errors.offsetX).toBeDefined();
    expect(errors.effectColor).toBeDefined();
  });

  it("allows negative and zero offsets", () => {
    expect(parseDefinitionForm(valid({ hasEffect: true, offsetX: "-64", offsetY: "0" })).ok).toBe(true);
  });

  it("reports every problem at once", () => {
    const errors = errorsOf(valid({ name: "", width: "0", color: "no" }));
    expect(Object.keys(errors).sort()).toEqual(["color", "name", "width"]);
  });
});

describe("formFromDefinition", () => {
  it("round-trips every built-in through the form unchanged", () => {
    for (const d of defs) {
      const result = parseDefinitionForm(formFromDefinition(d));
      if (!result.ok) throw new Error(`${d.name} did not parse`);
      const { id: _id, builtIn: _builtIn, ...expected } = d;
      expect(result.value).toEqual(expected);
    }
  });

  it("marks a centred effect as centred and a directional one as not", () => {
    const scarecrow = defs.find((d) => d.id === "builtin-scarecrow")!;
    expect(formFromDefinition(scarecrow).centered).toBe(true);
    const directional = { ...scarecrow, effect: { ...scarecrow.effect!, offsetY: 1 } };
    expect(formFromDefinition(directional).centered).toBe(false);
  });

  it("starts without an effect for definitions that have none", () => {
    expect(formFromDefinition(defs[0]!).hasEffect).toBe(false);
  });
});

describe("withCenteredOffsets", () => {
  it("recomputes offsets from the sizes when centred", () => {
    const form = withCenteredOffsets(valid({ width: "1", height: "1", effectWidth: "7", effectHeight: "5", centered: true }));
    expect(form.offsetX).toBe("-3");
    expect(form.offsetY).toBe("-2");
  });

  it("leaves offsets alone when not centred", () => {
    const form = valid({ centered: false, offsetX: "4", offsetY: "-4" });
    expect(withCenteredOffsets(form)).toEqual(form);
  });

  it("leaves offsets alone while a size is half-typed", () => {
    const form = valid({ effectWidth: "", offsetX: "9" });
    expect(withCenteredOffsets(form).offsetX).toBe("9");
  });
});
