# Pixel Farm Layout Planner

A web app for planning grid-based pixel-farm layouts. Drag crops, scarecrows, orbs and your own objects onto
a grid, see exactly what each one covers, and export the result as an image.

It runs entirely in the browser. There is no server and no account: layouts are saved in your
browser's LocalStorage.

## Features

- **Grids from 4×4 to 64×64.** The size menu offers 15×15, 17×17, 19×19, 21×21, 23×23, 25×25 and 27×27; any other size can be typed in.
- **Top and isometric views.** Switch the board between a straight-down grid and an isometric view like the game's, with blocks standing on the ground and their icons on top. Everything works in both views: place, move, rotate, select, and drag off the board to delete. The isometric view can be zoomed, and dragging empty ground pans it. The title row, view switch and zoom buttons stay in place while the board scrolls.
- **Drag and drop** from the palette, and move objects around the grid. Rotate while dragging with **R**.
- **Areas of effect.** A scarecrow covers 15×15, an element orb 13×13, a rain orb 7×7, a water orb 5×5. The areas are clipped at the grid edge, and where several overlap they stack, with a count where three or more do.
- **Built-in objects:** Crop (1×1, 2×2 and 4×4), Scarecrow, Element orb, Water orb, Rain orb and Path. All can be edited, deleted or restored with **Reset built-ins**.
- **Your own objects:** choose a size, colour, icon and an area of effect, with a live preview. Offsets can be set so an effect only reaches in one direction.
- **Label and recolour** any placed object, nudge, duplicate and delete it.
- **Undo and redo** the last 50 changes.
- **Several layouts:** switch, rename, duplicate and delete them.
- **Export** a layout as a **PNG** at 1x, 2x or 4x, in either the top or the isometric view, with options for the grid, effects, labels, coordinates and background. Or export it as **JSON**, and import JSON back in.
- **Works on phones and tablets.** On a small screen the board comes first, with an Objects / Edit panel underneath.

## Using it

| Do this | To |
|---|---|
| Drag an item from the palette | Place it. Press **R** while dragging to rotate |
| Click or tap a placed object | Select it (Shift or Ctrl-click for several) |
| Drag a placed object | Move it. Drop it clearly **off the board** to delete it |
| **R**, arrow keys, **Ctrl+D**, **Delete** | Rotate, nudge, duplicate, remove the selection |
| **Ctrl+Z**, **Ctrl+Shift+Z** | Undo, redo |
| **New object** in the palette | Create your own object |
| **Layouts** | Manage layouts, import JSON, or export a backup of all of them |
| **Top / Isometric** above the board | Switch how the board is drawn (your choice is remembered) |
| **Export** | Download a PNG (top or isometric view) or JSON of the open layout |

Your layouts live only in this browser. Use **Layouts → Export all** now and then to keep a backup,
especially before clearing browser data.

## Running it locally

You need [Node.js](https://nodejs.org/) 24.

```bash
npm install
npm run dev        # opens on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build the site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check the app and the tooling |
| `npm test` | Run the test suite |
| `npm run contrast` | Check that every text and boundary colour in the theme meets WCAG contrast |

## Built with

React 18, TypeScript (strict), Vite, Tailwind CSS, Zustand, zod, nanoid and Vitest. Pointer Events handle
drag and drop (mouse and touch), and the PNG export is drawn with the Canvas 2D API.

```
src/
  lib/          pure logic: grid and placement rules, editing, import/export, canvas renderer
  store/        layouts and the object library, with persistence
  hooks/        drag and drop, keyboard shortcuts, responsive helpers
  components/   top bar, palette, board, inspector, dialogs
  data/         built-in objects
  theme.css     colour, type and shape tokens: the one place styling is defined
  __tests__/    test suites
```

## Deploying

`npm run build` produces a static site in `dist/` that any static host can serve. Asset URLs are relative,
so it also works from a subpath such as a GitHub Pages project site (`https://<user>.github.io/<repo>/`).
Fonts load from Google Fonts; offline, the app falls back to system fonts.
