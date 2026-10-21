# Pixel Farm Layout Planner

A client-only web app for planning grid-based pixel-farm layouts. No backend, no account: everything
is saved in your browser's LocalStorage.

- Pick a grid from 4×4 to 64×64 and drag objects onto it (crops in three sizes, scarecrow, orbs, path, or your own).
- Objects can have an **area of effect** (a scarecrow covers 15×15, an element orb 13×13, and so on). Overlapping areas stack.
- Label and recolour objects, rotate them, undo and redo (last 50 steps).
- Keep several layouts, duplicate them, and back them up as JSON.
- Export a layout as a PNG at 1x, 2x or 4x.
- Works on phones: the board comes first, with an Objects / Edit panel underneath.

## Getting started

Needs Node.js 24 (the contrast check runs TypeScript directly).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` for the app and the tooling |
| `npm test` | Run the Vitest suite |
| `npm run contrast` | Check every text and boundary colour pair in the theme meets WCAG contrast |

## Using it

| Do this | To |
|---|---|
| Drag from the palette | Place an object. Press **R** while dragging to rotate |
| Click or tap an object | Select it (Shift/Ctrl-click for several) |
| Drag a placed object | Move it. Drop it more than a few pixels **off the board** to delete it |
| `R` / arrow keys / `Ctrl+D` / `Delete` | Rotate / nudge / duplicate / remove the selection |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| **New object** in the palette | Create your own: size, colour, icon, area of effect |
| **Layouts** | Switch, rename, duplicate, delete, import JSON, export a backup of everything |
| **Export** | Download a PNG (or JSON) of the open layout |

Your data lives only in this browser. Use **Layouts → Export all** now and then to keep a backup.

## Project layout

```
src/
  lib/          pure logic: grid and placement rules, editing, import/export, canvas renderer
  store/        Zustand stores (layouts, object library) and their persistence
  hooks/        drag and drop, keyboard shortcuts, responsive helpers
  components/   TopBar, Palette, Grid (board, objects, effects), Inspector, dialogs
  data/         built-in objects
  theme.css     the colour, type and shape tokens (single source of truth for styling)
  __tests__/    Vitest suites
```

[`CLAUDE.md`](./CLAUDE.md) is the architecture spec the app was built from, including the build-order
checklist.

## Deploying

`npm run build` produces a static site in `dist/` that can be hosted anywhere. Asset URLs are
relative, so it also works from a subpath such as GitHub Pages' `https://<user>.github.io/<repo>/`.
Fonts are loaded from Google Fonts at runtime; offline, the app falls back to system fonts.
