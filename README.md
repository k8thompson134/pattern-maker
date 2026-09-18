# Cross-Stitch Design Tool

A browser-based composition tool for designing small cross-stitch patterns from
text and icons, rather than converting an existing photo. See `docs/scope.md`
for the full scope doc and `docs/handoff.md` for the build plan.

No backend. React + Vite, canvas state persisted to localStorage, PDF export
via jsPDF.

## Status

Scaffolded — project skeleton (grid canvas, project/palette/tool layout,
localStorage autosave) only. Phase 1 features (text tool, drag/resize, DMC
color picker) not yet built.

## Running

```bash
npm install
npm run dev
```

## Structure

- `src/lib/types.ts` — project/canvas-object data model
- `src/lib/storage.ts` — localStorage load/save
- `src/components/CanvasGrid.tsx` — SVG stitch grid renderer
- `src/App.tsx` — toolbar / canvas / palette layout shell
