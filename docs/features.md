# Feature Reference & Gap Analysis

This is the complete reference for what the Cross-Stitch Design Tool can do
today, where its limits are, and where it falls short of what a cross-stitcher
would expect. It's written for someone who knows cross-stitch well but not this
codebase. Section 6 (the gap analysis) is the main input for deciding what to
build next.

For the original vision and market research, see [`scope.md`](scope.md).

---

## 1. Who it's for and the core workflow

Composing small original pieces from scratch: a name, a short phrase, a few
motifs. It is not for converting photos.

1. Set the canvas size in stitches and the fabric count.
2. Add text and icons, and optionally hand-draw stitches.
3. Arrange: move, size, align, repeat, group.
4. Export a PDF chart with a DMC thread list.

Everything autosaves to the browser as you go.

---

## 2. How a design is modeled

These rules explain most of the behavior (and most of the limits) below.

- **The grid is the fabric.** One cell = one full cross stitch. There are no
  half, quarter, or three-quarter stitches, and no backstitch.
- **A design is a stack of objects**, not a painted grid. Each object is one of:
  - **Text**: a phrase in one font, one color, one direction.
  - **Icon**: one motif from the library, in one color.
  - **Drawing**: a freehand set of stitches, where each stitch can be its own color.
- **Stacking order matters.** Objects later in the stack cover earlier ones
  where they overlap. The exported chart is exactly what's visible on screen:
  covered stitches don't appear and aren't counted.
- **Text and icons are single-color.** A two-tone motif has to be built as
  two overlapping objects or as a drawing.
- **Rotation turns the actual stitches** in 90° steps. What you see is exactly what exports.
- **Size is whole-number scaling.** At size 2×, every stitch of a letter or
  icon becomes a 2×2 block; 3× gives 3×3, up to 6×. There are no in-between
  sizes, because a fraction of a stitch can't be stitched.

---

## 3. Feature reference

### 3.1 Project and canvas

| Feature | Details |
| --- | --- |
| Canvas size | Width and height in stitches, 1 to 500 each. Default 60×60. Shrinking the canvas pulls objects back inside the edges. |
| Fabric count | Stitches per inch, 1 to 30 (e.g. 14 for 14-count Aida). Used only to show the finished size in inches. |
| Finished size | Shown above the canvas, e.g. `60×60 stitches · 5.5"×5.5" at 11 stitches/inch`. This is the stitched area only, with no margin for framing or finishing. |
| Zoom | 20% to 250% in 25% steps. On first load, a small screen zooms out to fit. |
| New project | Starts a blank 60×60 canvas. If the current design has anything on it, an inline warning asks you to confirm first ("Delete and start new" / "Keep editing"). Only one project exists at a time. |
| Project name | Not editable in the UI. The name is set only as the PDF title at export time. |

### 3.2 Text

| Feature | Details |
| --- | --- |
| Fonts | **Block 5×7** (7 stitches tall) and **Tiny 3×5** (5 stitches tall). |
| Characters | A–Z, 0–9, space, and `. , ! ? ' -`. Lowercase is typed fine but stitched as capitals. Any other character (accents, `&`, `@`, `:` …) becomes a blank space, but a red warning names the exact unsupported characters as you type, both in the Text tool and when editing a placed text object. |
| Direction | Across (left to right) or Down (letters stacked vertically). |
| Editing | The words, direction, and color can be changed after placing. The font cannot be changed after placing. |
| Size | 1× to 6×. See section 2. |
| Spacing | Letter and line spacing are fixed by the font. There's no kerning or multi-line text; each line is a separate text object. |

### 3.3 Icons

The library has 25 single-color motifs, each roughly 7–13 stitches across at 1×:

- **Sky and nature:** Heart, Sparkle, Crescent Moon, Sun, Cloud, Rainbow, Flower, Rose, Leaf
- **Food and critters:** Mushroom, Strawberry, Cherries, Bee, Butterfly, Ghost
- **Symbols:** Music Note, Lightning Bolt
- **Shapes:** Diamond, Circle, Square (outline), Triangle, Arrow
- **Doodles:** Spiral, Wavy Line, Zigzag. The wavy line and zigzag are wide and flat, meant for repeating into border strips.

Icons can be resized (1×–6×), rotated (0/90/180/270°), recolored, and repeated.
Three retired icons (Cross, Paw Print, Raised Fist) aren't in the picker but
still display correctly in older saved designs.

### 3.4 Stamp (tiny decorations)

A brush-like mode for scattering small accents. Pick one of four mini motifs
(Tiny Heart, Tiny Star, Tiny Dot, Tiny Diamond, 3–5 stitches each), turn on
Stamp mode, and each tap on the canvas drops one. They use the color currently
chosen in the Icons tool. Each stamp becomes a normal icon object you can move
or delete afterward.

### 3.5 Draw (freehand stitches)

| Feature | Details |
| --- | --- |
| Paint | Tap a cell to place a stitch in the chosen color. Different colors can be mixed in one drawing. |
| Erase | Removes a stitch from whichever drawing is on top at that spot, including drawings from earlier sessions. A drawing erased down to nothing disappears. Erase can't remove stitches from text or icons. |
| Input | One tap per stitch. There's no drag-to-paint, line, rectangle, fill, or mirror tool. |
| Sessions | Each Start drawing → Done drawing session creates one new drawing object. An earlier drawing can't be reopened to add to it. |
| After drawing | A drawing can be moved, duplicated, layered, aligned, and grouped. It can't be resized, rotated, recolored as a whole, or repeated. |

### 3.6 Selecting and arranging

| Feature | Details |
| --- | --- |
| Select | Tap or click an object. A dashed box and corner handles appear. |
| Move | Drag, the on-screen arrow pad (1 stitch per tap), or the keyboard arrow keys (Shift+arrow = 5 stitches). Objects can't leave the canvas. |
| Resize | Drag a corner handle, or use the − / + size buttons (text and icons only). |
| Rotate | 0°, 90°, 180°, 270° clockwise (text and icons). The object turns in place, around its center. The rotated shape is what's stitched and exported. |
| Align | To the canvas: left, center, right, top, middle, bottom. |
| Layer order | Send backward, bring forward, send to back, bring to front. |
| Duplicate | Places a copy just to the right. |
| Repeat | Makes a row or column of copies: count 2–50, gap 0–50 stitches between copies. Useful for border strips. Single text or icon only. |
| Multi-select | Shift-click (desktop) or the Select multiple mode (phone). The selection moves, duplicates, and deletes as one unit and keeps its spacing at the canvas edges. |
| Group | Group two or more objects; tapping any member then selects the whole group. Ungroup to split them apart. Duplicating a group makes a new, separate group. |
| Delete | Removes the selected object(s). |

Align, layer order, rotate, resize, and repeat apply to one object at a time,
not to a multi-selection or group.

### 3.7 Colors and threads

- **Palette:** 14 DMC colors: 310 Black, B5200 Snow White, 321 Red, 666
  Bright Red, 703 Chartreuse, 798 Delft Blue, 809 Delft Blue Lt, 972 Deep
  Canary, 3607 Plum Lt, 552 Violet Med, 992 Aquamarine, 3799 Charcoal, 415
  Pearl Grey, 976 Golden Brown. No other colors can be added.
- **Colors-used panel:** lists every DMC color in the design, live. Stitch
  counts only appear in the PDF.
- DMC is the only thread brand.

### 3.8 PDF export

- A4 page, portrait or landscape to match the design's shape.
- Title (prompted at export time), stitch dimensions, and finished size in inches.
- The whole grid fits on **one page**, scaled to fit, not at actual size.
- Stitches are shown as **filled color squares**, with no chart symbols.
- Grid lines are all the same thin light gray. There are no darker lines every 10 stitches, no row/column numbers, and no center marks.
- Legend: each DMC color with a swatch, name, and stitch count.
- Nothing is added to the export that you didn't ask for: no watermarks or branding.

### 3.9 Saving

- The current project autosaves to this browser after every change, including zoom.
- Multiple designs can exist side by side: **Save as…** copies the current design into a new named slot and switches you to editing that copy, leaving the original untouched. A **Design** dropdown appears once there's more than one, to switch between them. **Delete this design** removes the one you're viewing and switches to another saved one (or a fresh blank project if it was the last).
- Every text field shows the stitch size live as you type (e.g. `41×7 stitches`), and a placed text object's editing panel warns if it's now larger than the canvas.
- After 25 edits without a PDF export, a dismissible banner above the canvas suggests backing up. Exporting or dismissing resets the count.
- If saving fails (e.g. browser storage is full), a red banner warns you.
- If the saved project can't be read back, a banner says so and a new project starts.
- There is only one project, stored in one browser. There's no file to save, open, or share, and nothing syncs between devices.

### 3.10 Phone vs. desktop

- **Desktop:** tools are in a left sidebar as collapsible cards; the colors-used list is on the right.
- **Phone:** the canvas stays pinned at the top. Tools are tabs under it (Text / Icons / Stamp / Draw / Canvas), with one visible at a time. Selecting an object swaps the tab content for the object's controls.
- **Both:** while Draw, Stamp, or Select multiple is on, a banner above the canvas says which mode is active and has a Done button.
- The on-screen arrow pad and size buttons are the reliable way to adjust objects on touch screens. Drag and corner-resize work but haven't been fully verified on real phones.

### 3.11 Limits at a glance

| Thing | Limit |
| --- | --- |
| Canvas | 1–500 stitches per side |
| Object size | 1×–6× |
| Rotation | 90° steps, text and icons only |
| Fonts | 2 |
| Characters | A–Z, 0–9, space, `. , ! ? ' -` |
| Icons | 25 (+ 4 mini stamps) |
| Colors | 14 DMC, fixed |
| Repeat | 2–50 copies, 0–50 gap |
| Projects | 1, in one browser |
| Export | PDF, one A4 page |

---

## 4. Undo

**There is no undo or redo.** Every change is final and autosaved immediately.
Deleting an object, resizing the canvas smaller (which moves objects), or
pressing New project can't be reversed.

---

## 5. Known bugs and rough edges

| Issue | Effect on a stitcher |
| --- | --- |
| The PDF title uses a browser pop-up. | Minor, but it goes against the "no modals" design goal. |

### Fixed

- **Unsupported characters now warn as you type**, instead of silently becoming blanks. The text tool and the editing panel for a placed text object both show which exact characters (e.g. `&`, `é`) aren't supported and will be skipped.
- **Live stitch-size preview** while typing or editing text, so an oversized phrase is visible before it's placed rather than after.
- **A backup-reminder banner** appears after 25 edits with no PDF export, since designs live only in this browser with no file export/import yet.
- **Save as / duplicate a whole project**, to make variants of one layout (same text, different recipient) without retyping everything.
- **Undo/redo**, via toolbar buttons or Ctrl/Cmd+Z (Ctrl/Cmd+Shift+Z or Ctrl+Y to redo). Rapid edits to the same field (typing into a placed text object's content) merge into one undo step; view-only changes like zoom never appear in the history at all. Switching, duplicating, or starting a project begins a fresh undo history for it.

- **Rotation now reaches the export.** It used to change only the on-screen drawing, so rotated text and icons printed unrotated in the PDF, and alignment and canvas-edge limits used the wrong size. Rotation now changes the stitches themselves: the screen, PDF, stitch counts, alignment, and edge limits all match. Designs saved before this fix that used 90° or 270° may appear shifted by a few stitches, so check their position.
- **New project asks first** when the current design isn't empty.
- **Erase works on any drawing**, not just the one being drawn in the current session.

## 6. Gap analysis: what a cross-stitcher would expect

Each gap below is rated for how much it matters to someone actually stitching
the pattern:

- **High**: blocks or seriously hurts stitching.
- **Medium**: a noticeable friction or missing expectation.
- **Low**: nice to have.

A ✱ in the Roadmap column means the item is already planned in `scope.md`.

### 6.1 The printed chart

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| No chart symbols (colored squares only) | Standard charts put a symbol in each cell so similar colors can be told apart and a black-and-white printout still works. Red 321 vs. Bright Red 666 look nearly identical on paper. | **High** | ✱ ("symbol key") |
| No darker line every 10 stitches | Every stitcher counts in 10s. Without heavier gridlines, counting across a large chart is slow and error-prone. | **High** | |
| No center marks or row/column numbers | Stitchers usually start from the center of the fabric. Without arrows or numbers, finding it means counting by hand. | **High** | |
| One page, scaled to fit | A 100×100+ design becomes unreadably tiny. Real charts split across pages with overlap and page labels. | **High** for larger designs | |
| No thread/skein estimate | Stitchers need to know how many skeins to buy. The stitch counts are already there, so it's close. | Medium | |
| No fabric cutting size | Charts usually say how big to cut the fabric (design + 2–3" margin per side for framing). | Medium | |
| No designer name/date/notes on the PDF | Wanted for gifts and for selling patterns. | Low | ✱ (optional metadata) |

### 6.2 Threads and colors

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| Only 14 fixed DMC colors | DMC has ~500 colors. Skin tones, pastels, greens, browns, and neutrals are mostly missing. Stitchers often design around floss they already own. | **High** | ✱ ("DMC color picker") |
| No "swap this color everywhere" | Trying a different color scheme means recoloring every object by hand. | Medium | |
| No "my floss stash" palette | Designing from threads on hand is a common real-world constraint. | Low | |
| Stitch counts only in the PDF | Can't see thread usage while designing. | Low | |
| DMC only | Anchor/other-brand users must convert by hand. | Low | Out of scope for now |

### 6.3 Fabric and sizing

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| Fabric count is one number | Stitchers think in "14-count Aida" or "28-count evenweave over two" (= 14 stitches/inch). Evenweave/linen users have to do the math. | Medium | |
| No "fit my fabric" sizing | Scope use case 4: start from a real piece of fabric (inches) and get the stitch count, rather than the reverse. | Medium | ✱ (use case 4) |
| No hoop/frame guide or safe-margin overlay | Helps center a design for a specific hoop size. | Low | |

### 6.4 Lettering

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| Capitals only | Mixed-case names and phrases are a staple of samplers and gifts. | **High** | |
| Only 2 fonts, both blocky | Script, serif, and decorative sampler alphabets are core to cross-stitch lettering. | **High** | ✱ (more fonts) |
| Missing characters (`& : / # @ ♥` and accents) | Dates (`9/25`), `&` in couples' names, and accented names are all common. Missing ones silently vanish (section 5). | **High** | ✱ (accents) |
| No multi-line text or alignment | Each line is placed and centered by hand. | Medium | |
| Can't change the font after placing | Must delete and retype. | Low | |

### 6.5 Motifs and decoration

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| No borders or frames | Borders are one of the most common sampler elements. Repeat gets partway there, but corners have to be built by hand. | **High** | Task #518 |
| Icons are single-color | Most traditional motifs use 2–4 colors (a strawberry with green leaves, a mushroom with white spots). | **High** | |
| Can't upload your own motif | Personal and inside-joke motifs are a stated core use case. | Medium | ✱ (v1.1) |
| No saved personal motif library | Reusing motifs across projects. | Medium | ✱ (v1.1) |
| Themed icon sets (holidays, baby, wedding, pride, pets…) | The broader audiences in scope.md all hinge on relevant motifs. | Medium | ✱ (later) |
| No templates (birth announcement, wedding sampler) | Fast start for the life-event pieces the tool targets. | Low | ✱ (later) |

### 6.6 Drawing and editing

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| ~~No undo/redo~~ | ~~Fixed, see section 5.~~ | Fixed | |
| Erase can't touch text or icons | Stitchers often tweak a single stitch of a letter or motif. | Medium | |
| ~~No "save as" / duplicate whole project~~ | ~~Fixed — task #543, see section 5.~~ | Fixed | |
| Can't reopen an earlier drawing | Adding to a drawing later makes a new, separate object. | Medium | |
| Tap-one-stitch-at-a-time drawing | Slow for anything but tiny touches. Drag-to-paint, lines, fill, and mirror are standard in pixel/grid editors. | Medium | |
| Can't turn text or an icon into editable stitches | Would allow customizing a letter or motif stitch by stitch. | Medium | |
| Align/rotate/resize don't work on groups | Grouped layouts must be positioned by nudging. | Low | |
| No mirror/flip | Symmetric designs and facing motifs (two birds facing each other). | Low | ✱ (pixel-art section) |

### 6.7 Stitch types

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| No backstitch | Outlines and fine lettering in most modern patterns use backstitch. | Medium | Out of scope for now |
| No half/quarter/three-quarter stitches | Smooth curves and shading. | Low | Out of scope for now |
| No French knots/beads | Eyes, dots, texture. | Low | |

### 6.8 Projects and sharing

| Gap | Why it matters | Impact | Roadmap |
| --- | --- | --- | --- |
| Only one project at a time | Can't keep several designs (a series of fundraiser pieces) side by side. | **High** | |
| No save/open file | Can't back up a design, move it to another device, or send it to the person who'll stitch it. | Medium | ✱ (export-to-file, shareable layouts) |
| No PNG/image export | Quick preview to share on social media or with a gift recipient. | Low | ✱ (open question) |
| No stitched-look preview | Seeing the design as stitched Xs on fabric color helps judge contrast. | Low | |
| No name/date swapping for batches | Sellers and fundraisers make many variants of one layout. | Low | ✱ (mail-merge) |

### 6.9 Suggested priority

If the goal is "a stitcher can reliably stitch from what they design," the
highest-leverage next steps are:

1. **Chart readability:** symbols per color (#539), a darker line every 10 stitches and center marks (#540), and multi-page export for larger designs (#541).
2. **Full DMC palette**, plus recolor-everywhere (#544).
3. **Lettering:** lowercase, the missing punctuation (`& : / #`), and at least one more font style, script or serif (#545).

~~Save-as / duplicate project (#543)~~ and ~~undo/redo (#542)~~ — done, see section 5.
6. **Borders** (#518) and **multi-color motifs.**
