import { centeredOffset } from "../lib/grid";
import type { EffectDefinition, ObjectDefinition } from "../types";

// Fixed definitions for geometry tests (a 4x4 barn, a 2x1 fence, centred 7x7 and 3x3 effects). They
// are deliberately independent of the shipped built-ins, so changing the starter set never changes
// what the placement, rotation and rendering tests mean.

function centred(objW: number, objH: number, w: number, h: number, color: string): EffectDefinition {
  return {
    width: w,
    height: h,
    offsetX: centeredOffset(objW, w),
    offsetY: centeredOffset(objH, h),
    color,
    shape: "rect",
  };
}

export const FIXTURE_DEFINITIONS: ObjectDefinition[] = [
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
    effect: centred(1, 1, 7, 7, "#d3756b"),
    builtIn: true,
  },
  {
    id: "builtin-sprinkler",
    name: "Sprinkler",
    width: 1,
    height: 1,
    color: "#355f7e",
    icon: "💧",
    effect: centred(1, 1, 3, 3, "#4f86a8"),
    builtIn: true,
  },
  { id: "builtin-path", name: "Path", width: 1, height: 1, color: "#c9b398", builtIn: true },
  { id: "builtin-fence", name: "Fence", width: 2, height: 1, color: "#7a5640", builtIn: true },
  { id: "builtin-water", name: "Water", width: 1, height: 1, color: "#8dbbd6", builtIn: true },
];
