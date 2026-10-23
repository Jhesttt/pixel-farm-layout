import type { ObjectDefinition } from "../types.ts";

// WCAG contrast and colour-distance checks over the tokens in src/theme.css.

export type Tokens = Record<string, string>;

export interface PairResult {
  group: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  pass: boolean;
}

const TEXT = 4.5;
const BOUNDARY = 3;

/** Reads every `--color-name: #rrggbb;` declaration (the token name is returned without the prefix). */
export function parseTokens(css: string): Tokens {
  const tokens: Tokens = {};
  for (const m of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return tokens;
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE76 colour difference in Lab (D65). ~2 is just noticeable; >20 reads as clearly different. */
export function deltaE(a: string, b: string): number {
  const lab = (hex: string): [number, number, number] => {
    const [r, g, bl] = channels(hex).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    const xyz = [
      (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047,
      0.2126 * r + 0.7152 * g + 0.0722 * bl,
      (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883,
    ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)) as [number, number, number];
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// [foreground token, background tokens, group]. Text pairs need 4.5:1.
const TEXT_PAIRS: [string, string[], string][] = [
  ["ink", ["page", "paper", "sunken", "wash", "board", "peach-soft", "peach", "sage", "blue", "sage-wash", "blue-wash"], "body text"],
  ["ink-deep", ["accent", "peach", "peach-soft"], "text on accent and peach"],
  ["ink-soft", ["page", "paper", "sunken", "wash", "board"], "secondary text"],
  ["ink-faint", ["page", "paper", "sunken", "wash"], "placeholders and meta"],
  ["on-primary", ["primary", "primary-strong"], "text on primary"],
  ["paper", ["ink"], "text on dark toast"],
  ["primary", ["page", "paper"], "primary-coloured text (use primary-strong on wash)"],
  ["primary-strong", ["page", "paper", "wash"], "primary-coloured text (strong)"],
  ["negative", ["page", "paper", "wash", "negative-wash"], "destructive and invalid text"],
  ["sage-deep", ["page", "paper", "board", "sage-wash"], "valid-placement text"],
  ["blue-deep", ["page", "paper", "board", "blue-wash"], "info text"],
  ["effect-warm-edge", ["board"], "effect label on board"],
  ["effect-cool-edge", ["board"], "effect label on board"],
];

// Non-text boundaries and indicators need 3:1.
const BOUNDARY_PAIRS: [string, string[], string][] = [
  ["grid-line", ["board"], "grid cell lines"],
  ["grid-line-major", ["board"], "grid every-fifth lines"],
  ["board-edge", ["page", "paper"], "board frame"],
  ["control-edge", ["page", "paper", "wash", "sunken"], "input and button edges"],
  ["primary", ["page", "paper", "board"], "focus ring and selection"],
  ["sage-deep", ["board"], "valid placement outline"],
  ["negative", ["board"], "invalid placement outline"],
  ["effect-warm-edge", ["board"], "effect outline (warm)"],
  ["effect-cool-edge", ["board"], "effect outline (cool)"],
  ["scroll-thumb", ["scroll-track"], "scrollbar thumb"],
];

// Combinations the brief rules out; they must keep failing so nobody reaches for them.
const FORBIDDEN_TEXT_PAIRS: [string, string][] = [
  ["on-primary", "accent"],
  ["on-primary", "peach"],
  ["on-primary", "peach-soft"],
  ["ink", "accent"],
];

function check(tokens: Tokens, pairs: [string, string[], string][], min: number): PairResult[] {
  const results: PairResult[] = [];
  for (const [fg, bgs, group] of pairs) {
    for (const bg of bgs) {
      const f = tokens[fg];
      const b = tokens[bg];
      if (!f || !b) {
        results.push({ group, fg, bg, ratio: 0, min, pass: false });
        continue;
      }
      const ratio = contrastRatio(f, b);
      results.push({ group, fg, bg, ratio, min, pass: ratio >= min });
    }
  }
  return results;
}

export function checkTokenPairs(tokens: Tokens): PairResult[] {
  return [...check(tokens, TEXT_PAIRS, TEXT), ...check(tokens, BOUNDARY_PAIRS, BOUNDARY)];
}

/** Pairs that must stay below 4.5:1 (so a regression to them is noticed). Returns the ones that no longer fail. */
export function forbiddenPairsNowPassing(tokens: Tokens): string[] {
  return FORBIDDEN_TEXT_PAIRS.filter(([fg, bg]) => {
    const f = tokens[fg];
    const b = tokens[bg];
    return f && b && contrastRatio(f, b) >= TEXT;
  }).map(([fg, bg]) => `${fg} on ${bg}`);
}

// Label colours for text drawn on object fills. Must equal --color-ink-deep and --color-paper
// (checked in the contrast test) so canvas export and the DOM editor agree.
export const LABEL_INK = "#2a1616";
export const LABEL_PAPER = "#fffbf6";

/** The label colour (LABEL_INK or LABEL_PAPER) with the higher contrast on `fill`. */
export function labelColorFor(fill: string): string {
  return contrastRatio(LABEL_INK, fill) >= contrastRatio(LABEL_PAPER, fill) ? LABEL_INK : LABEL_PAPER;
}

/**
 * The outline / pattern colour for an effect of colour `fill`: the fill pulled toward the label ink
 * so it stays at least 3:1 against the board whatever colour the user picked.
 */
export function effectEdgeColor(fill: string): string {
  const [r, g, b] = channels(fill);
  const [ir, ig, ib] = channels(LABEL_INK);
  const mix = (a: number, i: number) => Math.round(a * 0.4 + i * 0.6);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(r, ir))}${hex(mix(g, ig))}${hex(mix(b, ib))}`;
}

/** The label colour a renderer should draw on `fill`: whichever of ink-deep / paper reads better. */
export function bestLabelColor(tokens: Tokens, fill: string): { token: string; ratio: number } {
  const options = (["ink-deep", "paper"] as const).map((token) => ({
    token: token as string,
    ratio: contrastRatio(tokens[token] as string, fill),
  }));
  return options.reduce((best, o) => (o.ratio > best.ratio ? o : best));
}

export interface ObjectColorReport {
  labels: { name: string; fill: string; label: string; ratio: number; pass: boolean }[];
  /** Pairs of built-ins whose fills are too close, and fills too close to the board. */
  tooClose: string[];
}

const MIN_OBJECT_DELTA_E = 18;
const MIN_BOARD_DELTA_E = 14;

export function checkObjectColors(tokens: Tokens, defs: ObjectDefinition[]): ObjectColorReport {
  const labels = defs.map((d) => {
    const best = bestLabelColor(tokens, d.color);
    return { name: d.name, fill: d.color, label: best.token, ratio: best.ratio, pass: best.ratio >= TEXT };
  });
  const tooClose: string[] = [];
  for (let i = 0; i < defs.length; i++) {
    const a = defs[i] as ObjectDefinition;
    const board = tokens["board"] as string;
    if (deltaE(a.color, board) < MIN_BOARD_DELTA_E) tooClose.push(`${a.name} vs board`);
    for (let j = i + 1; j < defs.length; j++) {
      const b = defs[j] as ObjectDefinition;
      if (deltaE(a.color, b.color) < MIN_OBJECT_DELTA_E) tooClose.push(`${a.name} vs ${b.name}`);
    }
  }
  return { labels, tooClose };
}

/**
 * `hex` mixed toward the label ink by `inkAmount` (0 keeps it, 1 is the ink): a darker shade of the
 * same colour, used for the side faces of isometric blocks.
 */
export function shadeColor(hex: string, inkAmount: number): string {
  const t = Math.min(1, Math.max(0, inkAmount));
  const [r, g, b] = channels(hex);
  const [ir, ig, ib] = channels(LABEL_INK);
  const mix = (c: number, i: number) => Math.round(c * (1 - t) + i * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r, ir))}${toHex(mix(g, ig))}${toHex(mix(b, ib))}`;
}
