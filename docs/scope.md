# Cross-Stitch Design Tool — Scope Doc

**Date:** September 18, 2026

---

## Vision

A browser-based cross-stitch design tool built for **composition, not conversion**. Nearly every tool on the market today (Stitch Fiddle, PCStitch, WinStitch, Pic2Pat, FlossCross) is optimized around turning an existing photo into a stitchable chart — color quantization, confetti cleanup, thread matching. That's a different problem than the one this solves.

This tool is for designing **small, original, personal pieces from scratch** — text, icons, simple motifs — quickly enough that making one doesn't eat an entire afternoon. Think: a greeting-card or sticker-design tool's workflow (canvas, drag, type, place), rewired to output a DMC-mapped stitch grid instead of a PNG.

**Who it's for:** primarily someone wanting fast, original, low-fuss pattern design rather than photo-to-pattern conversion — gifts, home decor, and small-batch pieces for events or fundraisers.

---

## Story

Started from a real project: inherited vintage cross-stitch fabric and supplies, and wanted to design a small original tapestry (text + icons, solidarity-themed) rather than stitch a pre-made pattern. Tried Stitch Fiddle as the obvious free option and hit its limits fast — no real text tool, no drag/group, no symbol placement, most of what was actually needed sat behind a $2.75–$5.50/month paywall.

That gap turned out to be structural, not just Stitch Fiddle being basic: the whole market is built by and for people converting photos into patterns, not people composing small original designs. That's worth building for on purpose — a tool that makes it fast to produce gift tapestries, home art, and small-batch pieces for events or fundraisers, without fighting software built for a different workflow.

---

## Market landscape

| Tool | Platform | Core focus | Price | Gap vs. this tool |
| --- | --- | --- | --- | --- |
| Stitch Fiddle | Web | Grid editor, photo import, backstitch | Free tier capped (300x300, 50 colors); $2.75–$5.50/mo premium | No text tool, no drag/group, no icon library, no object-based canvas |
| PCStitch / WinStitch / MacStitch | Windows/Mac desktop | Professional photo-to-pattern, 30+ thread brands | $49.95–$72 one-time | Desktop-only, old-school grid UI, built for faithful photo reproduction not fast original composition |
| Pic2Pat, FlossCross, Stitchmate, Thread-Bare | Web | Photo → pattern conversion | Free – paid tiers, some pay-per-export | All start from an uploaded photo; none support building from a blank canvas with text/icons |
| Knytstudio | Web | Community remix, text-to-pattern, progress tracking | Freemium | Closest in spirit (modern, web, some text support) but still grid-first, not composition-first |

**The gap:** every tool above is built around *conversion* (photo → stitch chart). Nothing in the current market is built around *composition* — starting from a blank canvas, typing text in a chosen font, dropping in small icons/symbols, arranging and grouping them, and exporting a DMC-mapped chart. That's a fundamentally different design workflow (closer to Canva or Affinity than to an image-quantization tool), and no one has built it for cross-stitch specifically.

---

## Core use cases

1. **Gift tapestry with an inside joke** — a short phrase or name for a specific family member/friend, done quickly, without needing to design from a blank grid by hand.

2. **Home art reflecting personal interests/identity** — a word, phrase, or small motif sized to a specific piece of fabric already on hand.

3. **Raffle/fundraiser pieces for campaigns, fundraisers, or events** — needs to be repeatable: make several small original pieces relatively fast for a specific campaign or event, likely reusing the same icon set or phrase style across pieces.

4. **Fabric-constrained design** — starting from a specific real piece of fabric (known dimensions, known or estimated thread count) rather than an abstract canvas size — the tool should make it easy to size a design to what's actually on hand.

5. **Personal icon/symbol reuse** — building up a small personal library of icons (in-joke motifs) that get reused across multiple future projects, rather than starting from scratch or a generic clipart pack each time.

---

## Feature list

### v1 (must work end-to-end)

- Canvas sized directly in stitch count (width x height), with a fabric-count → inches conversion shown alongside so the canvas maps to real fabric dimensions
- Text tool: type a phrase, pick from a small set of cross-stitch-legible bitmap fonts, auto-renders to the stitch grid
- A small curated icon library (10–20 well-chosen symbols to start, not thousands of generic clipart)
- Place, move, and resize text and icon objects on the canvas (basic drag, not full grouping yet)
- DMC color picker/mapping for the active palette
- Export as a printable chart (grid + symbol key + DMC color list), at minimum as PDF

### v1.1 / soon after

- Group multiple objects and move them together
- Upload a small custom icon (simple B&W/line art) and auto-convert to a tiny stitch-grid icon (e.g. 16x16 or 24x24) — a much smaller, more tractable version of "image to pattern" than full photo conversion
- Save/reuse a personal icon library across projects (local storage, no login required)
- Undo/redo

### Later / nice to have

- Multiple font weights/sizes per canvas
- Basic project save/load beyond local storage (account system)
- Community sharing of designed icon packs
- Support for other counted crafts (needlepoint, waste canvas) if the underlying grid model generalizes

### Explicitly out of scope for now

- Photo-to-pattern conversion (that's the whole existing market — not the gap this tool fills)
- Backstitch, half-stitches, quarter-stitches (adds real complexity, not needed for text/icon-based designs)
- Multi-thread-brand support (DMC only to start)

---

## Open questions

- [ ] Which specific fonts to include at v1 — need to check legibility at small stitch heights (5–7 stitches tall) before committing to a set
- [ ] What goes in the starter icon set — a narrow, personally-relevant set to start, or a broader general-purpose set from day one?
- [ ] Should this live as a subpage of the portfolio site, or as its own standalone domain/repo? (Subpage is simpler to ship and ties it to the portfolio story; standalone is cleaner if it grows.)
- [ ] Export format priority — PDF alone enough for v1, or is a plain image/PNG export of the chart also needed early for quick sharing?
- [ ] Local-storage-only for v1 vs. needing any persistence beyond the browser session — depends on whether projects need to survive across devices right away

---

## Beyond personal scope

The composition-not-conversion gap serves plenty of use cases outside personal gift-giving. Worth keeping the data model generic enough that these aren't precluded, even if not built for v1.

### Other audiences this could serve

- **Life-event pieces**: baby announcements (name, birth date/weight/length), weddings (names + date), anniversaries, retirements, graduations — all short-text-plus-icon by nature

- **Etsy/craft-fair sellers**: small shop owners who currently hand-grid custom orders one at a time; a fast text+icon tool with variable/mail-merge-style name swapping would let them turn around personalized orders much faster

- **Memorial and in-loving-memory pieces**: name, dates, a small symbol — emotionally high-stakes but structurally simple, and existing tools handle this badly

- **Pet portraits with name plates**: a step down from full photo conversion — pet's name + a simple icon (paw print, breed silhouette) rather than a realistic photo stitch

- **Identity and pride pieces**: LGBTQ+ pride symbols, disability pride, recovery/sobriety milestones, cultural heritage symbols — same "short text + meaningful icon" shape as the organizing use case, just a different symbol library

- **Teacher/coach/team gifts**: initials, team names, jersey numbers — short and icon-friendly

- **Sampler-style keepsakes**: family name + establishment date ("the Smiths, est. 2019") for housewarmings

- **Quilting/scouting badge-style patches**: small emblem + short text, a slightly different physical end-product but same design workflow

### Features that would matter more at this broader scale

- **Mail-merge / batch generation**: swap one name or date across a saved layout to generate many variants fast — huge for sellers and for repeat raffle/fundraiser use

- **A shared/community icon library**: users contributing and browsing symbol packs (holiday, pride, hobby-specific, sports) rather than only a small curated starter set

- **Multiple alphabet/font support**: accented characters and non-Latin scripts for names and phrases, which most existing cross-stitch alphabets handle poorly

- **Print-on-demand or poster export**: some users may want the design as wall art or a printed image rather than an actual stitched piece — same composition engine, different output path

- **Template starting points**: a light template layer ("baby announcement," "wedding sampler") that's still just text+icon placeholders, not the heavier pre-made-pattern model other tools use

- **Shareable/exportable layouts**: a link or file that lets one person design a piece and hand it to someone else to stitch — relevant for gift-giving where the designer and the stitcher aren't always the same person

None of this needs to be in v1. The main implication for scope: keep text and icons as generic composable objects, so the icon library and template layer can grow into other communities later without a rebuild.

---

## Use cases for pixel artists, creators, and makers

This audience fits unusually well: pixel art and cross stitch are already the same underlying medium (a fixed grid, a locked color palette, one "pixel"/stitch at a time). Most existing cross-stitch software wasn't built with that overlap in mind — it's built for turning continuous-tone photos into charts, which is a much lossier, fussier process than what a pixel artist actually needs. A tool built for composition rather than conversion is a much more natural fit for this crowd than for the traditional cross-stitch market.

### Use cases

- **Direct pixel-art-to-pattern**: import an already-gridded, already-indexed-palette piece (from Aseprite, Piskel, or similar) and get a 1:1 stitch mapping with no lossy color quantization needed — the hard part of every existing converter (confetti, color reduction) mostly doesn't apply here

- **Physical merch from digital work**: artists who want to sell or gift a stitched version of a sprite, icon, or small piece they already made digitally

- **Game/character fan art pieces**: small sprite-style fan pieces (original characters, or transformative fan work) sized for a single small stitch — mirrors the "gift with an inside joke" use case but for a fandom/creator community instead

- **Palette-variant pieces**: artists who make multiple color-swapped versions of the same design (a common pixel-art practice) — stitching several small variants of one motif

- **Collaborative/community grid pieces**: a shared large grid where multiple contributors each stitch one section — similar in spirit to pixel-art collab murals (r/place-style) but physical

- **Portfolio pieces**: makers who want a physical, stitchable version of a digital piece as a display item or a sellable print alternative

### Features that matter for this audience

- **Direct import of an already-palette-limited image** (PNG with a small distinct color count) with a true 1:1 pixel→stitch mapping option, skipping the quantization/confetti-cleanup pipeline entirely when the source is already clean

- **Snap-to-grid symmetry and mirroring tools** — standard in pixel art editors (Aseprite, Piskel), rare or absent in cross-stitch tools, and would make this tool feel native rather than foreign to that audience

- **A resolution/fabric-count calculator built around small pixel-art canvases** (16x16, 32x32) so an artist can see immediately what physical size a given sprite becomes at different fabric counts, without doing the math by hand

- **Dithering pattern preservation**: pixel-art dithering (checkerboard shading patterns) translates almost directly into stitch texture — worth preserving rather than flattening during import

- **Layer support**: even a lightweight version (background layer + foreground sprite) matches how pixel artists already think about a composition

- **Attribution/licensing metadata on exported patterns**: relevant if artists want to sell patterns of their own original pixel art through the tool or elsewhere

This audience overlaps with the "community icon library" idea — pixel artists are a natural source of high-quality, already-grid-native icon contributions, which could help solve the "who builds the icon library" problem without having to hand-design every symbol.

---

## Validation: what the communities are actually saying

### Cross-stitch community pain points

- **Unwanted branding on generated text**: a PCStitch user reported that the software's Text feature inserts a "Copyright DMC" mark on the pattern even when using a custom-designed alphabet, which makes patterns feel unprofessional to sell. — a concrete, avoidable gap: don't put anything on an export the user didn't ask for.

- **Custom branding is wanted, but paywalled**: a shop owner using Cross Stitch Professional specifically wanted their own logo/shop name on exported materials, but that's locked behind an extra ~£200 tier. — relevant to the Etsy-seller use case already in scope.

- **Simplicity and clean output are valued over feature density**: a long-time user's stated reason for switching to MacStitch was that it combined an older tool's simplicity with PCStitch's clean look, while producing much smaller PDF files than either. — a signal to resist feature bloat in v1.

### Pixel art / maker community signals

- **The medium overlap is already widely recognized**: pixel art and cross stitch share the same core constraints (limited palette, fixed grid, no anti-aliasing), so pixel art converts to a stitch chart with almost no quality loss — unlike a photo, which needs heavy simplification and produces messy "confetti."

- **The community is already building workarounds inside pixel art tools**, because nothing serves this directly: a published Aseprite brush pack lets artists paint with cross-stitch-shaped brushes instead of plain pixels, explicitly marketed for embroidery pattern design and textile-style game assets. — real evidence of unmet demand.

- **Direct competitive signal**: Stitchmate already accepts `.aseprite` files and preserves layer structure for non-destructive iteration between Aseprite and the stitch chart. — this specific angle (pixel-art-native import) is not an open field; it's still bolted onto a conversion-first tool rather than built composition-first, which is where this project's differentiation would need to hold.

---

## Design & Implementation constraints

### Technical approach

No backend needed for v1. Canvas/SVG rendering in the browser, local storage for saving icon libraries and project sketches. This keeps it simple to ship and lets users work fully offline once the page loads. Consider a lightweight export-to-file path for portability if people want to move patterns between devices early.

### Low-spoons UX

Autosave the current canvas state after every meaningful change (placement, text edit, color pick). No unsaved-work anxiety, no losing a 5-minute composition to a browser crash. Resumability across sessions means returning to a project should land the user exactly where they left it — canvas state, zoom level, palette. This is critical for someone managing PEM and energy scarcity; the tool should work with that, not against it. Similarly, avoid modal dialogs and forced flows; let people start, pause, and return without guilt.

### Fan art and intellectual property

The tool itself stays agnostic on IP. Users uploading sprites, designing fan-art patterns, and exporting charts are responsible for their own fair use and licensing. Don't watermark exports or impose restrictions that mimic what existing tools do (the Copyright DMC issue found in community feedback). Do include an optional metadata field on export (artist name, date, license choice if they want to state one) for users who want to share or sell their own work clearly, but make it optional and never inject anything the user didn't ask for.
