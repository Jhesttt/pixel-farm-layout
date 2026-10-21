// Quick picks for an object's colour override. All come from the theme, are distinct from each
// other, and keep a readable label (checked in the contrast test).
export interface MarkingColor {
  name: string;
  hex: string;
}

export const MARKING_COLORS: MarkingColor[] = [
  { name: "Sage", hex: "#8fb07e" },
  { name: "Forest", hex: "#3e6a4b" },
  { name: "Sky", hex: "#8dbbd6" },
  { name: "Dusty blue", hex: "#355f7e" },
  { name: "Mustard", hex: "#ddaa4f" },
  { name: "Peach", hex: "#f0997d" },
  { name: "Rose", hex: "#a75d5d" },
  { name: "Brick", hex: "#9b2c2c" },
  { name: "Sand", hex: "#c9b398" },
  { name: "Bark", hex: "#7a5640" },
];
