# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project Context

A browser-based composition tool for designing small cross-stitch patterns from
text and icons, rather than converting an existing photo (that's the whole
existing market — see `docs/scope.md` for the full rationale and `docs/handoff.md`
for the original build plan). No backend — React + Vite, canvas state persisted to
localStorage, PDF export planned via jsPDF (installed, not yet wired up).

**Status as of 2026-09-19:** All of Phase 1 and Phase 2 (per `docs/handoff.md`)
are now done, plus several usability items added from live testing beyond the
original plan: layer ordering (forward/backward/to-front/to-back), a freeform
multi-color pixel drawing tool (paint/erase individual stitches, for small
decorations text/icons can't cover), per-object delete (surfaced immediately at
the top of the selected-object panel, not buried at the bottom), and editable
canvas size (was hardcoded to 60x60 at project creation with no way to change
it — existing objects re-clamp into bounds when the canvas shrinks). Mobile
usability — the thing the user cared about most for v1 — is solid: responsive
layout, tap-based D-pad + size stepper as the reliable path, gesture
drag/resize as a nice-to-have on top.

**PDF export** (`src/lib/exportPdf.ts`, jsPDF) fits the whole grid on one page
(scaled to fit, not 1:1 physical size) with a title, dimensions, the colored
stitch grid, and a DMC color/stitch-count legend below it — verified by
rendering an actual exported PDF back to an image (`sips -s format png`) and
visually confirming grid position and legend content, not just that a file got
written. `src/lib/flattenProject.ts` (`flattenProject`/`summarizeColors`) is
the shared pure logic backing it — collapses every object into one grid
respecting z-order (later objects overwrite earlier ones at the same cell,
matching what's visually on screen), independently unit-tested. If another
export format is ever needed (PNG, SVG), start from `flattenProject`, not a
fresh render pass — it's already the single source of truth for "what does
this pattern actually look like flattened."

v1 is now feature-complete against the original plan. Remaining ideas are
already-identified stretch goals, not gaps: continuous drag-to-paint for the
Draw tool (currently tap-one-cell-at-a-time), grouping (mentioned as a
low-priority v1 placeholder in `docs/handoff.md`, never built), and the mobile
gesture-reliability question in "Known Issues" below.

## Architecture

- `src/lib/types.ts` — `Project`/`CanvasObject` (`TextObject` | `IconObject` | `PixelObject`) data model. `PixelObject` is the odd one out — no `scale`, no single `color` (each cell carries its own `StitchColor`) — see the guards for `selectedObject.kind !== 'pixels'` in `App.tsx` before assuming every object has `.scale`/`.color`.
- `src/lib/fonts.ts`, `src/lib/textRender.ts` — bitmap fonts (Block 5x7, Tiny 3x5) and text→stitch-cell rendering
- `src/lib/icons.ts`, `src/lib/iconRender.ts` — the 16-icon curated library and icon→stitch-cell rendering
- `src/lib/pixelObject.ts` — `paintCell`/`eraseCell` for freeform drawings. Always rebases `x`/`y` to the true top-left and every cell's `dx`/`dy` to `>= 0` after every edit, so `PixelObject` satisfies the same "`x`/`y` is the left/top edge" invariant `TextObject`/`IconObject` get for free — this is what lets `measureObject`/`clampToCanvas`/`align` work on pixel drawings with no special-casing.
- `src/lib/objectMeasure.ts` — `measureObject`/`clampToCanvas`, `MAX_OBJECT_SCALE`; the one place text/icon/pixels sizing logic converges
- `src/lib/align.ts` — six-direction alignment (left/center-h/right/top/center-v/bottom), routes through `clampToCanvas`
- `src/lib/resizeHandle.ts` — pure corner-anchor resize math (`computeResizeFromHandle`), no DOM/React — kept pure specifically so the anchor-corner geometry (easy to get backwards) could be unit-tested exhaustively. Only used for text/icon — pixel drawings resize by adding/removing stitches, not a uniform NxN factor, so corner handles are hidden for them (`CanvasGrid.tsx` checks `.kind !== 'pixels'` before rendering handles).
- `src/lib/id.ts` — `createId()`, a `crypto.randomUUID()` wrapper with a fallback (see Known Issues)
- `src/lib/flattenProject.ts` — `flattenProject`/`summarizeColors`, collapses every object into one z-ordered grid of absolute stitches; shared source of truth for PDF export (and any future export format)
- `src/lib/exportPdf.ts` — `exportProjectToPdf`, builds the printable chart (grid + DMC legend) via jsPDF and triggers a browser download
- `src/components/CanvasGrid.tsx` — the SVG canvas: grid lines, object rendering (per-cell color for pixels, single `obj.color` for text/icon), drag, corner-drag resize, selection overlay, and a draw-mode overlay rect (topmost, only rendered while `drawMode` is on) that intercepts taps for paint/erase instead of normal select/drag. `CELL_SIZE` and `MAX_OBJECT_SCALE` are exported/imported as the single source of truth other files reference — don't hardcode either elsewhere.
- `src/App.tsx` — toolbar (text/icon/draw tools, selected-object panel with layer/direction/size/position/color/align controls + delete), palette panel (flattens per-object color, or per-cell colors for pixel drawings), keyboard nudge handling, draw-session state (`activePixelObjectId` — which pixel object new paint/erase strokes target; cleared when draw mode toggles off so the next session starts a fresh drawing)

## Known Issues / Troubleshooting

### Mobile touch gestures (drag/resize) — investigated and mostly fixed, but not fully verified on a real device

**Reported (2026-09-18):** on an Android phone, dragging or resizing a placed
object sometimes moved/scrolled the page view instead of moving the object.

**Root causes found and fixed** (confirmed via headless Chrome + Puppeteer with mouse input,
diagnosed with `document.elementFromPoint()` at the exact failing coordinates):

1. **Grid lines intercepted touches.** `.canvas-grid__lines line` rendered on top
   of objects in SVG paint order with no `pointer-events` override. A touch
   landing precisely on a gridline's stroke hit the line instead of the object
   beneath it, and the line has no touch-action/handler, so the browser
   defaulted to scrolling. Fixed with `pointer-events: none` on the lines.
2. **Empty space inside an icon's silhouette had no hit target.** Drag hit-testing
   only responded to actually-filled stitch pixels. Touching a gap inside an
   icon (a heart's notch, a crescent moon's curve) hit nothing, fell through to
   the canvas background (no touch-action override there either), and the
   browser scrolled. Fixed by adding an invisible hit-rect covering each
   object's *full bounding box*, not just its filled cells.
3. Resize handles were 14px, under the ~44px touch-target guideline. Bumped to 24px.
4. Added explicit `touch-action: none` directly on every object `<rect>` (not
   just the parent `<g>`, in case ancestor-chain touch-action evaluation is
   inconsistent for SVG), plus `e.preventDefault()` in the pointerdown/pointermove
   handlers as defense-in-depth.

**What's still genuinely unverified:** whether a real touch can still get
hijacked into a scroll in some remaining case. Attempting to verify this via
Puppeteer's touch emulation (`page.touchscreen`) hit a hard wall: Chrome
DevTools Protocol marks its synthetic `touchstart`/`touchmove` events as **not
cancelable**, and a browser's scroll-vs-gesture decision is made by the
compositor thread before JS runs. In testing, `pointerdown`/`pointermove` fired
correctly and *were* cancelable, `preventDefault()` was called on both — and
the browser still fired `pointercancel` after the first `pointermove` and
handed the gesture to native scroll. That's a documented CDP limitation for
synthetic touch input, not something fixable from application code. It means
headless/automated testing cannot fully prove a *genuine* touch (cancelable,
compositor-evaluated normally) won't hit some other remaining gap.

The underlying hit-testing/drag logic itself was confirmed correct using
**mouse** input instead (not subject to the CDP limitation) — dragging from an
empty gap inside an icon, and corner-resizing, both worked exactly as
expected. So the two bugs above are real, structural fixes, not guesses — but
"no more scrolling" as a whole hasn't been proven on genuine hardware.

**Mitigation shipped given that uncertainty:** rather than keep chasing an
unverifiable gesture bug, added tap-based controls that don't depend on
gestures at all — an on-screen D-pad (↑↓←→, 1 stitch per tap) and a −/+ size
stepper, mirroring the existing keyboard-arrow-nudge logic. User confirmed
(2026-09-18) the D-pad "works perfect." **This is the reliable v1 path.**
Gesture drag/corner-resize remain in place as a nice-to-have, but shouldn't be
assumed reliable on touch until verified on-device.

**If this resurfaces, in order of what to check:**
1. Test on the actual Android phone, not headless Chrome — the one thing this
   investigation structurally couldn't do.
2. At the exact failing touch coordinates, check `document.elementFromPoint(x, y)`
   — both bugs found so far were "wrong element received the touch," not a
   fundamental touch-action failure.
3. Grep for any new SVG element rendered on top of objects (paint order matters
   in SVG) that might be missing `pointer-events: none`.
4. As a last resort, consider `touch-action: none` on the whole `.canvas-grid`
   SVG rather than per-element — but that trades away native pan-to-scroll
   for the canvas itself, which is currently how panning works at low zoom.

### Corner-drag resize felt like "small then suddenly giant"

Reported 2026-09-18. Originally `MAX_OBJECT_SCALE` was 3, so there were only
three discrete sizes to land on. Scale has to stay a whole integer — each
glyph/icon pixel becomes an NxN block of stitches, and a fractional scale would
put half-stitches on the grid, which isn't representable in real cross-stitch —
so "finer control" means more integer steps, not fractional ones. Bumped
`MAX_OBJECT_SCALE` (`src/lib/objectMeasure.ts`) from 3 to 6. If 6 still feels
coarse, the next lever is the same one — raise the constant further — not a
fractional-scale redesign.

## Testing Conventions

**`npx tsc --noEmit` is a silent no-op in this repo — do not trust it.** The
root `tsconfig.json` is a solution-style file (`"files": []`, only
`references` to `tsconfig.app.json`/`tsconfig.node.json`); running plain
`tsc --noEmit` against it checks nothing and exits 0 regardless of what's
broken. This went unnoticed for most of a session (2026-09-19) — real type
errors (a new `PixelObject` union member missing fields other code assumed
existed) were sitting uncaught while `npx tsc --noEmit` kept reporting clean.
**Always use `npx tsc -b --force` (build mode) for a standalone type-check, or
just run `npm run build`**, which correctly invokes `tsc -b` first. If you ever
need to double check whether a "clean" type-check is real, force a deliberate
error (e.g. `const _x: string = someRealValue`) and confirm it's actually
reported — a silently-accepted deliberate error means you're checking nothing.

Real unit tests exist (`npm run test`, vitest) for pure logic — bitmap
rendering, resize/align geometry, id generation, canvas clamping. Run before
considering any change done. `resizeHandle.ts`'s corner-anchor math in
particular is deliberately framework-free specifically so it could be
exhaustively unit-tested — that kind of geometry is easy to get subtly
backwards, and it was worth locking down with tests rather than eyeballing it.

There's no permanent browser-automation test setup (no Playwright/Cypress
config committed). Interactive/visual verification during this project's build
used a disposable pattern instead:

1. `npm install --no-save --silent puppeteer-core` (temporary; points at the
   system's installed Chrome via `executablePath`, so no ~200MB Chromium
   download)
2. Write a one-off `scratch-*.mjs` script that drives the running dev server —
   click/type/drag/screenshot, read `localStorage` directly to assert on real
   state rather than just eyeballing a screenshot
3. `rm` the script and `npm uninstall puppeteer-core` afterward — never commit
   either

This keeps the repo free of a heavy test-browser dependency while still
getting real interactive verification. Reuse this pattern rather than adding a
permanent E2E framework unless the project's scope grows enough to justify one.

## Mobile Dev Server Access (Tailscale)

`vite.config.ts` allowlists the Tailscale hostname
(`kates-mac-mini.tail778117.ts.net`) in `server.allowedHosts` — Vite's dev
server otherwise 403s any `Host` header it doesn't recognize (DNS-rebinding
protection). To test on a phone over Tailscale:

```bash
npm run dev -- --host 0.0.0.0 --port 5910
```

Then visit `http://kates-mac-mini.tail778117.ts.net:5910/` from the phone. This
is a foreground process (dies on terminal close or Mac restart) — not yet a
persistent background service like Lair's launchd-managed apps. If this
project needs reliable always-on phone access going forward, that's worth
setting up properly rather than re-running the command each session.

**`crypto.randomUUID()` note:** that API requires a secure context (HTTPS or
`localhost`) — accessing the dev server via the Tailscale hostname over plain
HTTP doesn't qualify, and it's simply undefined there, which crashed the app on
first load until `src/lib/id.ts` added a fallback ID generator. Don't call
`crypto.randomUUID()` directly anywhere else in this codebase — use
`createId()` from `src/lib/id.ts`.
