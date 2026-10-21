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
  { id: "builtin-crop-2", name: "Crop 2×2", width: 2, height: 2, color: "#d6e8b0", icon: "🌿", builtIn: true },
  { id: "builtin-crop-4", name: "Crop 4×4", width: 4, height: 4, color: "#4f7d57", icon: "🌾", builtIn: true },
  {
    id: "builtin-scarecrow",
    name: "Scarecrow",
    width: 1,
    height: 1,
    color: "#ddaa4f",
    icon: "🎃",
    effect: centeredEffect(1, 1, 15, 15, "#d3756b"),
    builtIn: true,
  },
  {
    id: "builtin-element-orb",
    name: "Element orb",
    width: 1,
    height: 1,
    color: "#8c5a6e",
    icon: "🔮",
    effect: centeredEffect(1, 1, 13, 13, "#a8658a"),
    builtIn: true,
  },
  {
    id: "builtin-water-orb",
    name: "Water orb",
    width: 1,
    height: 1,
    color: "#355f7e",
    icon: "💧",
    effect: centeredEffect(1, 1, 5, 5, "#4f86a8"),
    builtIn: true,
  },
  {
    id: "builtin-rain-orb",
    name: "Rain orb",
    width: 1,
    height: 1,
    color: "#8dbbd6",
    icon: "🌧️",
    effect: centeredEffect(1, 1, 7, 7, "#5fa39b"),
    builtIn: true,
  },
  { id: "builtin-path", name: "Path", width: 1, height: 1, color: "#c9b398", builtIn: true },
];

/**
 * Built-ins that earlier versions shipped and this one no longer does. Saved data may still use
 * them, so startup removes their placements and the library migration drops the definitions.
 */
export const RETIRED_BUILTIN_IDS = [
  "builtin-tree",
  "builtin-barn",
  "builtin-sprinkler",
  "builtin-fence",
  "builtin-water",
] as const;

/** `current` with every built-in restored to its seed values (re-adding deleted ones); custom ones stay. */
export function withBuiltInsReset(current: ObjectDefinition[]): ObjectDefinition[] {
  return [
    ...BUILT_IN_DEFINITIONS,
    ...current.filter((d) => !BUILT_IN_DEFINITIONS.some((b) => b.id === d.id)),
  ];
}
