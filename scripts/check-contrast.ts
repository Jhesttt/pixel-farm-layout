// Prints the contrast table for src/theme.css and the built-in object colours.
// Run with `npm run contrast`; exits 1 if any pair fails.
import { readFileSync } from "node:fs";
import { BUILT_IN_DEFINITIONS } from "../src/data/builtIns.ts";
import {
  checkObjectColors,
  checkTokenPairs,
  forbiddenPairsNowPassing,
  parseTokens,
} from "../src/theme/contrast.ts";

const tokens = parseTokens(readFileSync(new URL("../src/theme.css", import.meta.url), "utf8"));

const rows = checkTokenPairs(tokens);
let group = "";
for (const r of rows) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group} (needs ${r.min}:1)`);
  }
  console.log(
    `  ${r.pass ? "ok  " : "FAIL"} ${r.fg} on ${r.bg}`.padEnd(46) +
      `${tokens[r.fg]} / ${tokens[r.bg]}  ${r.ratio.toFixed(2)}:1`,
  );
}

const objects = checkObjectColors(tokens, BUILT_IN_DEFINITIONS);
console.log("\nbuilt-in labels (needs 4.5:1)");
for (const l of objects.labels) {
  console.log(`  ${l.pass ? "ok  " : "FAIL"} ${l.name.padEnd(10)} ${l.fill}  ${l.label} ${l.ratio.toFixed(2)}:1`);
}
console.log(`\nbuilt-in colours too close: ${objects.tooClose.length ? objects.tooClose.join(", ") : "none"}`);

const regressed = forbiddenPairsNowPassing(tokens);
console.log(`ruled-out pairs that now pass (should be none): ${regressed.length ? regressed.join(", ") : "none"}`);

const failures =
  rows.filter((r) => !r.pass).length +
  objects.labels.filter((l) => !l.pass).length +
  objects.tooClose.length +
  regressed.length;
console.log(`\n${rows.length} token pairs, ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
