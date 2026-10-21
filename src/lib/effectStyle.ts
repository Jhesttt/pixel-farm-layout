// How areas of effect are styled, shared by the editor's EffectLayer and the PNG export so the
// two look the same.

/** Opacity of an effect's tint; overlapping areas add up. */
export const EFFECT_FILL_ALPHA = 0.3;

/** A cell covered by this many areas or more carries a count badge. */
export const MIN_STACK_FOR_COUNT = 3;

export const EFFECT_PATTERN_COUNT = 3;

/** A stable texture (0 diagonal, 1 opposite diagonal, 2 dots) per definition. */
export function effectPatternIndex(defId: string): number {
  let h = 0;
  for (const ch of defId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % EFFECT_PATTERN_COUNT;
}
