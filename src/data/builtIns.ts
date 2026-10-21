import type { EffectDefinition, ObjectDefinition } from "../types";

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
    offsetX: -Math.floor((effectW - objW) / 2),
    offsetY: -Math.floor((effectH - objH) / 2),
    color,
    shape: "rect",
  };
}

export const BUILT_IN_DEFINITIONS: ObjectDefinition[] = [
  { id: "builtin-crop", name: "Crop", width: 1, height: 1, color: "#4ade80", icon: "🌱", builtIn: true },
  { id: "builtin-tree", name: "Tree", width: 2, height: 2, color: "#15803d", icon: "🌳", builtIn: true },
  { id: "builtin-barn", name: "Barn", width: 4, height: 4, color: "#b91c1c", icon: "🏠", builtIn: true },
  {
    id: "builtin-scarecrow",
    name: "Scarecrow",
    width: 1,
    height: 1,
    color: "#d97706",
    icon: "🎃",
    effect: centeredEffect(1, 1, 7, 7, "#f59e0b"),
    builtIn: true,
  },
  {
    id: "builtin-sprinkler",
    name: "Sprinkler",
    width: 1,
    height: 1,
    color: "#0284c7",
    icon: "💧",
    effect: centeredEffect(1, 1, 3, 3, "#38bdf8"),
    builtIn: true,
  },
  { id: "builtin-path", name: "Path", width: 1, height: 1, color: "#a8a29e", builtIn: true },
  { id: "builtin-fence", name: "Fence", width: 2, height: 1, color: "#92400e", builtIn: true },
  { id: "builtin-water", name: "Water", width: 1, height: 1, color: "#3b82f6", builtIn: true },
];
