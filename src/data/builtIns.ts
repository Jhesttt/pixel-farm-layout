import { centeredOffset } from "../lib/grid.ts";
import type { EffectDefinition, ObjectDefinition } from "../types.ts";

// Effect centered on the footprint (section 3): offset = -floor((effectSize - objSize) / 2)
function centeredEffect(
  objW: number,
  objH: number,
  effectW: number,
  effectH: number,
  color: string,
): EffectDefinition {
  return {
    width: effectW,
    height: effectH,
    offsetX: centeredOffset(objW, effectW),
    offsetY: centeredOffset(objH, effectH),
    color,
    shape: "rect",
  };
}

export const BUILT_IN_DEFINITIONS: ObjectDefinition[] = [
  { id: "builtin-crop", name: "Crop", width: 1, height: 1, color: "#8fb07e", icon: "🌱", builtIn: true },
  { id: "builtin-tree", name: "Tree", width: 2, height: 2, color: "#3e6a4b", icon: "🌳", builtIn: true },
  { id: "builtin-barn", name: "Barn", width: 4, height: 4, color: "#a75d5d", icon: "🏠", builtIn: true },
  {
    id: "builtin-scarecrow",
    name: "Scarecrow",
    width: 1,
    height: 1,
    color: "#ddaa4f",
    icon: "🎃",
    effect: centeredEffect(1, 1, 7, 7, "#d3756b"),
    builtIn: true,
  },
  {
    id: "builtin-sprinkler",
    name: "Sprinkler",
    width: 1,
    height: 1,
    color: "#355f7e",
    icon: "💧",
    effect: centeredEffect(1, 1, 3, 3, "#4f86a8"),
    builtIn: true,
  },
  { id: "builtin-path", name: "Path", width: 1, height: 1, color: "#c9b398", builtIn: true },
  { id: "builtin-fence", name: "Fence", width: 2, height: 1, color: "#7a5640", builtIn: true },
  { id: "builtin-water", name: "Water", width: 1, height: 1, color: "#8dbbd6", builtIn: true },
];

/** `current` with every built-in restored to its seed values (re-adding deleted ones); custom ones stay. */
export function withBuiltInsReset(current: ObjectDefinition[]): ObjectDefinition[] {
  return [
    ...BUILT_IN_DEFINITIONS,
    ...current.filter((d) => !BUILT_IN_DEFINITIONS.some((b) => b.id === d.id)),
  ];
}
