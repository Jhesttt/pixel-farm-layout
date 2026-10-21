import { GRID_MAX_SIZE, centeredOffset } from "./grid";
import type { ObjectDefinition } from "../types";

// Form state and validation for the object editor. Fields are strings so half-typed numbers are
// allowed while editing; parseDefinitionForm turns a complete form into a definition.

export interface DefinitionForm {
  name: string;
  width: string;
  height: string;
  color: string;
  icon: string;
  hasEffect: boolean;
  effectWidth: string;
  effectHeight: string;
  offsetX: string;
  offsetY: string;
  effectColor: string;
  /** Keep the effect centred on the footprint: offsets follow the sizes. */
  centered: boolean;
}

export type DefinitionInput = Omit<ObjectDefinition, "id" | "builtIn">;
export type FormErrors = Partial<Record<keyof DefinitionForm, string>>;

export const NAME_MAX = 30;
export const ICON_MAX_SYMBOLS = 2;
export const OFFSET_LIMIT = GRID_MAX_SIZE;
export const DEFAULT_COLOR = "#8fb07e";
export const DEFAULT_EFFECT_COLOR = "#d3756b";

const HEX = /^#[0-9a-fA-F]{6}$/;
const INTEGER = /^-?\d+$/;

function parseInteger(text: string): number | null {
  return INTEGER.test(text.trim()) ? Number(text.trim()) : null;
}

function symbolCount(text: string): number {
  return [...new Intl.Segmenter().segment(text)].length;
}

export function emptyForm(): DefinitionForm {
  return {
    name: "",
    width: "1",
    height: "1",
    color: DEFAULT_COLOR,
    icon: "",
    hasEffect: false,
    effectWidth: "3",
    effectHeight: "3",
    offsetX: "-1",
    offsetY: "-1",
    effectColor: DEFAULT_EFFECT_COLOR,
    centered: true,
  };
}

export function formFromDefinition(def: ObjectDefinition): DefinitionForm {
  const effect = def.effect;
  const base = emptyForm();
  return {
    ...base,
    name: def.name,
    width: String(def.width),
    height: String(def.height),
    color: def.color,
    icon: def.icon ?? "",
    hasEffect: effect !== undefined,
    ...(effect && {
      effectWidth: String(effect.width),
      effectHeight: String(effect.height),
      offsetX: String(effect.offsetX),
      offsetY: String(effect.offsetY),
      effectColor: effect.color,
      centered:
        effect.offsetX === centeredOffset(def.width, effect.width) &&
        effect.offsetY === centeredOffset(def.height, effect.height),
    }),
  };
}

/** The form with its offsets recomputed to centre the effect, when that is on and the sizes are valid. */
export function withCenteredOffsets(form: DefinitionForm): DefinitionForm {
  if (!form.centered) return form;
  const w = parseInteger(form.width);
  const h = parseInteger(form.height);
  const ew = parseInteger(form.effectWidth);
  const eh = parseInteger(form.effectHeight);
  if (w === null || h === null || ew === null || eh === null) return form;
  return { ...form, offsetX: String(centeredOffset(w, ew)), offsetY: String(centeredOffset(h, eh)) };
}

function checkRange(
  errors: FormErrors,
  field: keyof DefinitionForm,
  text: string,
  min: number,
  max: number,
  label: string,
): number | null {
  const n = parseInteger(text);
  if (n === null || n < min || n > max) {
    errors[field] = `${label} must be a whole number from ${min} to ${max}.`;
    return null;
  }
  return n;
}

export function parseDefinitionForm(
  form: DefinitionForm,
): { ok: true; value: DefinitionInput } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};

  const name = form.name.trim();
  if (name === "") errors.name = "Give the object a name.";
  else if (name.length > NAME_MAX) errors.name = `Keep the name to ${NAME_MAX} characters.`;

  const width = checkRange(errors, "width", form.width, 1, GRID_MAX_SIZE, "Width");
  const height = checkRange(errors, "height", form.height, 1, GRID_MAX_SIZE, "Height");

  if (!HEX.test(form.color)) errors.color = "Pick a colour.";

  const icon = form.icon.trim();
  if (icon !== "" && symbolCount(icon) > ICON_MAX_SYMBOLS) {
    errors.icon = `Use at most ${ICON_MAX_SYMBOLS} symbols.`;
  }

  let effect: DefinitionInput["effect"];
  if (form.hasEffect) {
    const ew = checkRange(errors, "effectWidth", form.effectWidth, 1, GRID_MAX_SIZE, "Effect width");
    const eh = checkRange(errors, "effectHeight", form.effectHeight, 1, GRID_MAX_SIZE, "Effect height");
    const ox = checkRange(errors, "offsetX", form.offsetX, -OFFSET_LIMIT, OFFSET_LIMIT, "Horizontal offset");
    const oy = checkRange(errors, "offsetY", form.offsetY, -OFFSET_LIMIT, OFFSET_LIMIT, "Vertical offset");
    if (!HEX.test(form.effectColor)) errors.effectColor = "Pick an effect colour.";
    if (ew !== null && eh !== null && ox !== null && oy !== null && !errors.effectColor) {
      effect = { width: ew, height: eh, offsetX: ox, offsetY: oy, color: form.effectColor, shape: "rect" };
    }
  }

  if (Object.keys(errors).length > 0 || width === null || height === null) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      width,
      height,
      color: form.color,
      ...(icon !== "" && { icon }),
      ...(effect && { effect }),
    },
  };
}
