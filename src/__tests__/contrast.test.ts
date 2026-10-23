/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFINITIONS } from "../data/builtIns";
import { MARKING_COLORS } from "../data/markingColors";
import {
  checkObjectColors,
  checkTokenPairs,
  contrastRatio,
  deltaE,
  effectEdgeColor,
  forbiddenPairsNowPassing,
  LABEL_INK,
  LABEL_PAPER,
  labelColorFor,
  parseTokens,
  shadeColor,
} from "../theme/contrast";

// Vitest does not hand CSS imports through (even with ?raw), so read the file directly.
const tokens = parseTokens(readFileSync(new URL("../theme.css", import.meta.url), "utf8"));

describe("contrast math", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("deltaE is zero for equal colours and large for opposites", () => {
    expect(deltaE("#a75d5d", "#a75d5d")).toBe(0);
    expect(deltaE("#000000", "#ffffff")).toBeGreaterThan(90);
  });
});

describe("theme tokens", () => {
  it("defines the four brand colours from the brief", () => {
    expect(tokens["primary"]).toBe("#a75d5d");
    expect(tokens["accent"]).toBe("#d3756b");
    expect(tokens["peach"]).toBe("#f0997d");
    expect(tokens["peach-soft"]).toBe("#ffc3a1");
  });

  it("every text pair reaches 4.5:1 and every boundary pair 3:1", () => {
    const failing = checkTokenPairs(tokens).filter((r) => !r.pass);
    expect(failing.map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} < ${r.min}`)).toEqual([]);
  });

  it("keeps the combinations the brief rules out failing", () => {
    expect(forbiddenPairsNowPassing(tokens)).toEqual([]);
  });
});

describe("built-in object colours", () => {
  const report = checkObjectColors(tokens, BUILT_IN_DEFINITIONS);

  it("every label is readable on its fill (4.5:1 with the better of ink / paper)", () => {
    expect(report.labels.filter((l) => !l.pass).map((l) => `${l.name} ${l.ratio.toFixed(2)}`)).toEqual([]);
  });

  it("every object is clearly distinct from the others and from the board", () => {
    expect(report.tooClose).toEqual([]);
  });
});

describe("label colours", () => {
  it("LABEL_INK and LABEL_PAPER match the theme tokens", () => {
    expect(LABEL_INK).toBe(tokens["ink-deep"]);
    expect(LABEL_PAPER).toBe(tokens["paper"]);
  });

  it("picks the more readable colour for every built-in fill", () => {
    for (const d of BUILT_IN_DEFINITIONS) {
      const picked = labelColorFor(d.color);
      const other = picked === LABEL_INK ? LABEL_PAPER : LABEL_INK;
      expect(contrastRatio(picked, d.color)).toBeGreaterThanOrEqual(contrastRatio(other, d.color));
      expect(contrastRatio(picked, d.color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses dark text on light fills and light text on dark fills", () => {
    expect(labelColorFor("#ffffff")).toBe(LABEL_INK);
    expect(labelColorFor("#000000")).toBe(LABEL_PAPER);
  });
});

describe("marking colours", () => {
  it("each keeps a readable label and is distinct from the board and from the others", () => {
    const board = tokens["board"] as string;
    for (const [i, c] of MARKING_COLORS.entries()) {
      expect(contrastRatio(labelColorFor(c.hex), c.hex), c.name).toBeGreaterThanOrEqual(4.5);
      expect(deltaE(c.hex, board), `${c.name} vs board`).toBeGreaterThanOrEqual(14);
      for (const other of MARKING_COLORS.slice(i + 1)) {
        expect(deltaE(c.hex, other.hex), `${c.name} vs ${other.name}`).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe("effectEdgeColor", () => {
  it("keeps at least 3:1 against the board for any fill, including very light ones", () => {
    const board = tokens["board"] as string;
    const fills = [
      ...BUILT_IN_DEFINITIONS.flatMap((d) => (d.effect ? [d.effect.color] : [])),
      ...MARKING_COLORS.map((c) => c.hex),
      "#ffffff", "#ffff00", "#00ffff", "#f5e4cf", "#000000",
    ];
    for (const fill of fills) {
      expect(contrastRatio(effectEdgeColor(fill), board), fill).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns a valid hex colour", () => {
    expect(effectEdgeColor("#d3756b")).toMatch(/^#[0-9a-f]{6}$/);
    expect(effectEdgeColor("#000000")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("shadeColor", () => {
  it("keeps the colour at 0, reaches the label ink at 1, and clamps outside that range", () => {
    expect(shadeColor("#8fb07e", 0)).toBe("#8fb07e");
    expect(shadeColor("#8fb07e", 1)).toBe(LABEL_INK);
    expect(shadeColor("#8fb07e", -3)).toBe("#8fb07e");
    expect(shadeColor("#8fb07e", 9)).toBe(LABEL_INK);
  });

  it("gets darker as the amount grows", () => {
    const lum = (hex: string) => contrastRatio(hex, "#ffffff");
    const light = lum("#d6e8b0");
    const mid = lum(shadeColor("#d6e8b0", 0.25));
    const dark = lum(shadeColor("#d6e8b0", 0.5));
    expect(mid).toBeGreaterThan(light); // darker means more contrast with white
    expect(dark).toBeGreaterThan(mid);
  });

  it("returns a valid hex colour", () => {
    expect(shadeColor("#ffffff", 0.3)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
