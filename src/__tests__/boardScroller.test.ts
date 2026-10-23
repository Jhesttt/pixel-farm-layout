/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// The boards size themselves from their scroller's width. If that width depended on whether a
// scrollbar is showing, a board whose height lands near the window's height made the scrollbar
// flicker every frame (seen at 1920px wide). Reserving the gutter prevents it. A real browser with
// scrollbars is needed to see the bug itself, so this guards the two things that prevent it.
describe("board scroller gutter", () => {
  it("reserves the scrollbar gutter for every board scroller", () => {
    const css = read("theme.css");
    const rule = /\[data-board-scroller\]\s*\{([^}]*)\}/.exec(css);
    expect(rule, "a [data-board-scroller] rule in theme.css").not.toBeNull();
    expect(rule?.[1]).toMatch(/scrollbar-gutter:\s*stable\s+both-edges/);
  });

  it.each(["components/Grid/GridCanvas.tsx", "components/Grid/IsoCanvas.tsx"])(
    "%s marks its scrolling container so the rule applies",
    (file) => {
      expect(read(file)).toMatch(/data-board-scroller/);
    },
  );
});
