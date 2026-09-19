# QA Review — Cross-Stitch Design Tool v1 (feature mode)

**Date:** 2026-09-18
**Scope:** Full v1 build — canvas/objects (`src/App.tsx`, `src/components/CanvasGrid.tsx`), persistence (`src/lib/storage.ts`), export (`src/lib/exportPdf.ts`, `src/lib/flattenProject.ts`), data model (`src/lib/types.ts`), pixel drawing (`src/lib/pixelObject.ts`), plus the in-progress uncommitted UI polish (collapsible toolbar sections, dark theme in `src/index.css`).

No prior git changes flagged a narrower target, so this reviews the whole shipped v1 surface per `CLAUDE.md`'s "feature-complete" status note, cross-checked against `docs/scope.md` and `docs/handoff.md`.

---

## 1. Error paths

- **`saveProject` (`src/lib/storage.ts:5-7`) has no error handling**, and fires from a `useEffect` on every `project` change (`App.tsx:43-45`) — i.e. every keystroke, drag, and paint stroke. `localStorage.setItem` throws `QuotaExceededError` when the quota is hit (very reachable here: freeform pixel drawings can accumulate hundreds of cells serialized per-cell, and private-browsing Safari caps localStorage much lower). An uncaught throw inside a `useEffect` breaks the app with no user-facing signal — directly undermines the scope doc's stated "no unsaved-work anxiety" promise, since silent autosave failure is the *worst* case for that promise, not a neutral one.
- **`loadProject` (`src/lib/storage.ts:9-17`) swallows JSON parse errors and returns `null`**, which `App.tsx:23` treats identically to "no saved project" — silently falling back to a brand-new empty project. If a save ever gets corrupted (interrupted write, storage corruption), the user loses all prior work with zero indication anything went wrong.
- `exportProjectToPdf` (`src/lib/exportPdf.ts`) has no try/catch around the jsPDF calls or `doc.save()`. Low risk in practice (jsPDF rarely throws on generation), but there's no user feedback if the browser blocks the download or the save fails.

## 2. Loading / pending states

Not applicable in the traditional sense — everything here is synchronous (no network calls, no background threads). N/A, not a gap.

## 3. Third-party-service-down handling

N/A — no backend, no third-party API dependency. This is by design per the scope doc.

## 4. Schema / migration completeness

- `Project.palette` (`src/lib/types.ts:59`, populated as `[]` in `createEmptyProject`) is dead: nothing ever reads or writes it. The palette panel in `App.tsx:407-411` derives colors live from `project.objects` instead. Not a bug, but it's a field in the persisted schema that's pure noise — worth either wiring up or deleting so the type doesn't imply behavior that doesn't exist.
- Erasing every cell from a `PixelObject` leaves an inert `{ cells: [] }` object permanently in `project.objects` (`src/lib/pixelObject.ts:32-35`, `rebase`) — nothing filters it out. Harmless to rendering/export (zero cells → nothing drawn, nothing in the palette), but it silently accumulates in state/localStorage over a long drawing session.

## 5. Consistency across touchpoints

N/A — single UI, no other surface (mobile/Discord/API) to diverge from.

## 6. Docs

`CLAUDE.md`'s "Status as of 2026-09-19" section and Architecture list predate the two most recent commits (`Add Duplicate/Repeat and icon Stamp mode for pattern decoration`, `Stamp mode now uses dedicated tiny decoration icons`) and the in-progress uncommitted work (collapsible `<details>` toolbar sections, full dark-theme rewrite of `index.css`). None of Duplicate, Repeat (border/string pattern), or Stamp mode are mentioned anywhere in `CLAUDE.md`. Worth a doc pass once the current uncommitted UI work lands.

## 7. Honesty check — what got cut

Against `docs/handoff.md`'s v1 checklist, everything in "must work end-to-end" is actually built (canvas sizing w/ fabric-count conversion, text tool, icon library, place/move/resize, DMC picker, PDF export) — and several v1.1 items shipped early too (layer ordering, editable canvas size were v1.1-adjacent asks not in the original phase list). Nothing was quietly dropped from the *stated* v1 scope.

What's genuinely still open, all previously self-disclosed rather than newly found here:
- **Mobile touch drag/resize reliability is still unverified on real hardware** (`CLAUDE.md` "Known Issues") — the structural fixes are real, but the headless-testing limitation means this is still an open risk, not a closed one. Worth a real on-device pass before calling mobile UX done, since mobile is stated as the top v1 priority.
- Grouping, custom icon upload, and undo/redo remain unbuilt — but these are explicitly v1.1/"later" in `docs/scope.md`, not silently cut v1 scope.
- Continuous drag-to-paint for the Draw tool is still tap-one-cell-at-a-time — also an already-named stretch goal, not a surprise gap.

## 8. Basic security sanity

No SQL, no shell, no backend — nothing user-typed (text content, project name, PDF title) reaches anything but the DOM/canvas/jsPDF. No issues found. PDF filename generation (`exportPdf.ts:83`, `title.trim().replace(/\s+/g,'-').toLowerCase()`) is a client-side `doc.save()` call; the browser owns filename sanitization, no injection surface.

## Housekeeping (not a bug)

`scratch-screenshots.mjs` is sitting untracked in the repo root. `CLAUDE.md`'s own testing convention says disposable Puppeteer scratch scripts should be `rm`'d and never committed — this one just needs cleaning up, it hasn't been committed so no harm done yet.

---

## Bugs / defects — ranked

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | `saveProject` has no error handling; a quota-exceeded (or any) `localStorage.setItem` throw silently breaks autosave with no user warning — undermines the core "no unsaved-work anxiety" promise | high | xs | P0 |
| 2 | PDF export grid can overflow the page for large canvases — `cellSize` floors at 0.5mm, so canvases wide/tall enough (reachable within the allowed 1–500 stitch range) render a chart wider/taller than the A4 page | high | s | P0 |
| 3 | `loadProject` silently discards a corrupted save and starts a fresh empty project with no warning | medium | xs | P1 |
| 4 | Erased-to-empty `PixelObject`s linger permanently in `project.objects` / localStorage | low | xs | P3 |

## Improvements — ranked

| # | Improvement | Value | Effort | Priority |
|---|-------------|-------|--------|----------|
| 1 | Remove or wire up the dead `Project.palette` field so the schema matches actual behavior | low | xs | P3 |
| 2 | Update `CLAUDE.md` Status/Architecture to cover Duplicate, Repeat, Stamp mode, and the in-progress dark theme/collapsible toolbar | medium | xs | P2 |
| 3 | Verify drag/corner-resize on a real Android touchscreen (only remaining unverified piece of the mobile gesture work) | high | s | P1 |
| 4 | Clean up untracked `scratch-screenshots.mjs` per the project's own disposable-script convention | low | xs | P3 |

---

## Candidate learnings

- **Autosave-on-every-change needs its own failure path.** In a localStorage-only, no-backend app where autosave is the entire safety net, an unhandled `setItem` throw is a silent total-failure mode, not an edge case — worth a standing pattern (wrap writes, surface a lightweight "couldn't save" indicator) for future localStorage-first tools.
- **"Fits to page" export math needs an explicit floor/overflow check**, not just a `Math.max` clamp — clamping a per-cell size without checking the resulting total against the page bounds silently produces off-page content instead of failing loudly or re-paginating.
