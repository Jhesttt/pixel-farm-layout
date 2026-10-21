export type Cell = { x: number; y: number };

// What an object IS (template in the palette)
export interface ObjectDefinition {
  id: string;
  name: string;
  width: number; // footprint in cells
  height: number;
  color: string; // default fill, hex
  icon?: string; // optional emoji / short glyph drawn on the footprint
  effect?: EffectDefinition;
  builtIn: boolean; // false for user-created definitions
}

// Area of effect, relative to the object's footprint
export interface EffectDefinition {
  width: number; // e.g. 7
  height: number; // e.g. 7
  offsetX: number; // top-left of effect relative to object's top-left cell
  offsetY: number; // default centers the effect on the footprint
  color: string; // rendered semi-transparent
  shape?: "rect" | "circle" | "custom"; // v1 implements "rect" only
  customCells?: Cell[]; // only when shape === "custom", relative to object origin
}

// An object placed on a specific layout
export interface PlacedObject {
  id: string;
  defId: string;
  x: number; // top-left cell
  y: number;
  rotation: 0 | 90 | 180 | 270; // swaps width/height for non-square objects
  label?: string; // user annotation, drawn on the footprint
  colorOverride?: string; // user marking color
  showEffect: boolean; // per-object toggle
}

export interface FarmLayout {
  id: string;
  name: string;
  width: number; // 4..64
  height: number;
  objects: PlacedObject[];
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}
