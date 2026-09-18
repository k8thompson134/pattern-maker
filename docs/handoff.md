# Cross-Stitch Design Tool — Handoff for Claude Code

**Scope doc:** `/home/claude/cross-stitch-design-tool-scope.md`

---

## What to build: v1 minimum viable

A browser-based composition tool for designing small cross-stitch patterns from scratch using text + icons. **Not** a photo-to-pattern converter — that's the entire existing market. This tool fills the gap for people who want to type a phrase, pick an icon, and export a chart without learning a grid editor.

**Core workflow:**
1. Set canvas size in stitch count (with fabric-count → inches conversion visible)
2. Add text object (pick from 3–4 cross-stitch-legible bitmap fonts, auto-renders to grid)
3. Add icon from a small curated library
4. Drag/resize/place objects on canvas
5. Pick DMC colors for the palette
6. Export as PDF chart (grid + symbol key + DMC list)

---

## Tech stack (v1, no backend)

- **Canvas:** SVG or HTML5 Canvas for the stitch grid rendering
- **State:** React with useState/useReducer to track canvas objects (text, icons, colors)
- **Persistence:** localStorage for saving icon library and project state (autosave on every change)
- **Export:** generate PDF (jsPDF or similar) with the grid, legend, and color list
- **Fonts:** pre-built small bitmap font set (5–7 stitches tall); research legibility before picking

**No need for:** backend, login, accounts, accounts, database, real-time collaboration. Offline-first, localStorage-only for v1.

---

## Design approach

**Aesthetic:** minimal, clean, workmanlike. The existing cross-stitch community praised simple tools with no bloat. Don't over-design.

**Key UX constraints:**
- **Autosave on every change** (text edit, object placement, color pick) — no unsaved-work anxiety
- **Resumable sessions** — returning to a project should land the user exactly where they left it (canvas state, zoom, palette)
- **Accessible for low-spoons work** — avoid modals, forced flows, and deep menus; let people start/pause/return guilt-free
- **No watermarks or injected branding** on exports (this is a specific pain point in existing tools)

**Layout:** probably a canvas in the center, a toolbar (text, icon, color tools) on one side or top, a palette/DMC list on the other. Keep the stitch grid always visible and zoomable.

---

## Priorities and order

### Phase 1: Core canvas + text
1. Canvas component that renders an SVG grid (stitch count → visible squares)
2. Text tool that converts typed input + font choice into stitch coordinates
3. Drag/move/resize for text objects
4. DMC color picker for text color
5. Basic zoom/pan so the grid stays usable at any size

### Phase 2: Icons + export
6. Small hardcoded icon library (start with 10–15: fist, rose, star, heart, paw, etc.)
7. Add icon tool (drag to place, resize, color-pick)
8. Grouping placeholder (doesn't need to be sophisticated yet)
9. Export to PDF with grid + legend + DMC color list

### Phase 3+: Refinement
- Custom icon upload (PNG → tiny stitch grid)
- localStorage save/load
- Undo/redo
- Polish and testing

---

## Specific decisions to make while building

- **Fabric count math:** the scope assumes ~22-count evenweave, stitched over 2 (effective 11 stitches/inch). Bake this into the inches conversion or make it user-settable? (Probably start with 11 stitches/inch as default, with a dropdown for other counts.)
- **Default icon set:** should these be generic (fist, rose, star, heart) or themed toward specific audiences? Start generic; let the community grow it later.
- **Font selection:** pick 3–4 legible fonts and test them at 5–7 stitches tall before committing. Courier/monospace variants work well; avoid serifs.
- **Grid appearance:** consider a subtle grid (light gray lines) vs. clear cell borders. Clear is better for low-vision accessibility.
- **Toolbar location:** left sidebar or top bar? Sidebar probably better for keeping canvas large, but test both if you have energy.

---

## What NOT to do in v1

- Photo import or image-to-pattern conversion (out of scope)
- Backstitch, half-stitches, quarter-stitches (too complex for this scope)
- Multi-thread-brand support (DMC only)
- Account system or cloud saving (localStorage enough)
- Community features (save that for later)
- Fancy animations or effects (keep it minimal)

---

## Remember

This tool exists to make it **fast** to produce small, personal, original designs without fighting a conversion pipeline. Every feature should serve that goal. If something makes the happy path slower or more confusing, it doesn't belong in v1.

The low-spoons UX constraint is real and matters — autosave, resumability, and avoiding friction should be baked in from the start, not bolted on later.

Good luck. You've got this.
