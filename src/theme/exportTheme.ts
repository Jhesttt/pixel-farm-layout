// Colours the PNG export draws with. They mirror the tokens in src/theme.css (a test keeps them in
// step), because canvas cannot read CSS variables.
export const EXPORT_THEME = {
  page: "#fff6ee",
  paper: "#fffbf6",
  board: "#f5e4cf",
  boardEdge: "#8f6b58",
  gridLine: "#9c7a66",
  gridLineMajor: "#6f4f42",
  inkDeep: "#2a1616",
  inkSoft: "#6a4a46",
  primary: "#a75d5d",
  sageDeep: "#3e6a4b",
  negative: "#9b2c2c",
  /** --color-ink-deep at 70%: the ring around every object. */
  objectEdge: "rgba(42, 22, 22, 0.7)",
  /** --color-ink-deep at 40%: the outline of a count badge. */
  badgeEdge: "rgba(42, 22, 22, 0.4)",
} as const;

/** Which CSS token each colour above mirrors, for the sync test. */
export const EXPORT_THEME_TOKENS: Record<string, keyof typeof EXPORT_THEME> = {
  page: "page",
  paper: "paper",
  board: "board",
  "board-edge": "boardEdge",
  "grid-line": "gridLine",
  "grid-line-major": "gridLineMajor",
  "ink-deep": "inkDeep",
  "ink-soft": "inkSoft",
  primary: "primary",
  "sage-deep": "sageDeep",
  negative: "negative",
};

export const EXPORT_FONT = '"Nunito Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif';
export const EXPORT_EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
