# Cross-Stitch Design Tool

A browser-based tool for **composing** small, original cross-stitch patterns from
text, icons, and hand-drawn stitches, then exporting a printable chart with a DMC
thread list. It isn't a photo-to-pattern converter; that's what nearly every
other tool on the market does.

Built for quick, personal pieces: gifts with a name or inside joke, small home
art, and repeatable fundraiser or event pieces.

## What it does

- **Canvas sized in stitches**, with the finished size in inches for a chosen fabric count
- **Text** in two cross-stitch-legible bitmap fonts (Block 5×7, Tiny 3×5), horizontal or vertical
- **Icon library** of 25 motifs, plus tiny "stamp" decorations for scattering accents
- **Freehand drawing**: paint or erase individual stitches in any palette color
- **Arrange**: drag, resize, rotate, align, layer, duplicate, repeat into a row or column, multi-select, and group
- **DMC colors**: the full 489-color DMC range (searchable), a live list of colors used, and replace-a-color-everywhere
- **PDF export**: a one-page chart with title, dimensions, colored grid, and DMC legend with stitch counts
- **Autosave**: the current project saves to the browser after every change
- **Works on phones**: tabbed tools, tap-based arrows and size buttons, touch drag

For the full feature reference and a gap analysis from a stitcher's point of
view, see [`docs/features.md`](docs/features.md).

## Running

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build
npm run test       # unit tests (vitest)
```

No backend or accounts. Everything runs in the browser, and projects persist in
`localStorage`.

## Tech

React + TypeScript + Vite. The canvas is SVG, and PDF export uses jsPDF.

| Path | What's there |
| --- | --- |
| `src/App.tsx` | Tool panels, selection panel, and app state |
| `src/components/CanvasGrid.tsx` | SVG stitch grid: rendering, drag, resize, selection |
| `src/lib/types.ts` | Project and canvas-object data model |
| `src/lib/fonts.ts`, `icons.ts`, `dmcColors.ts` | Bitmap fonts, icon library, DMC palette |
| `src/lib/flattenProject.ts` | Collapses all objects into the final stitch grid (used by export) |
| `src/lib/exportPdf.ts` | PDF chart generation |

## Credits

DMC color data: [craft-color-codes](https://github.com/makebead/craft-color-codes) by MakeBead (https://makebead.com), CC BY 4.0.

## Docs

- [`docs/features.md`](docs/features.md): complete functionality reference, known limitations, and feature gaps
- [`docs/scope.md`](docs/scope.md): original vision, market research, and roadmap
- [`docs/handoff.md`](docs/handoff.md): original v1 build plan
