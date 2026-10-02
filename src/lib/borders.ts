import { createId } from './id'
import { byCode } from './iconColors'
import type { BorderMargins, BorderSides, PixelCell, PixelObject, StitchColor } from './types'

// A border style is one repeating tile. Row 0 is the outer edge; '1' is the main color, '2' the accent.
export type BorderDef = {
  id: string
  name: string
  rows: string[]
  main: string
  accent: string
  // Keep the motif upright along the bottom edge instead of mirroring it outward.
  upright?: boolean
  // Tile column drawn in the four corner squares (a plain stretch of the connecting line), so motifs
  // start after each corner instead of colliding there.
  corner?: number
}

export const BORDERS: BorderDef[] = [
  { id: 'line', name: 'Line', rows: ['1'], main: '310', accent: '310' },
  { id: 'double-line', name: 'Double line', rows: ['1', '0', '1'], main: '310', accent: '310' },
  { id: 'dots', name: 'Dots', rows: ['10'], main: '310', accent: '310' },
  { id: 'checker', name: 'Checker', rows: ['1100', '1100', '0011', '0011'], main: '310', accent: '310' },
  { id: 'zigzag', name: 'Zigzag', rows: ['000100', '001010', '010001', '100000'], main: '310', accent: '310' },
  { id: 'waves', name: 'Waves', rows: ['01110000', '10001000', '00000111'], main: '3843', accent: '310' },
  { id: 'scallop', name: 'Scallop', rows: ['0011100', '0100010', '1000001'], main: '798', accent: '310' },
  {
    id: 'diamonds',
    name: 'Diamonds',
    rows: ['001000', '011100', '111110', '011100', '001000'],
    main: '3607',
    accent: '310',
  },
  {
    id: 'hearts',
    name: 'Strung hearts',
    rows: ['01010000', '11111222', '01110000', '00100000'],
    main: '666',
    accent: '3607',
    upright: true,
    corner: 6,
  },
  {
    id: 'hearts-large',
    name: 'Large hearts',
    rows: ['01101100000', '11111110000', '11111112222', '01111100000', '00111000000', '00010000000'],
    main: '666',
    accent: '3607',
    upright: true,
    corner: 9,
  },
  {
    id: 'vine',
    name: 'Vine',
    rows: ['00200000', '02200000', '11111111', '00000220', '00000020'],
    main: '701',
    accent: '704',
    corner: 7,
  },
  { id: 'daisies', name: 'Daisies', rows: ['011100', '112110', '011100'], main: '603', accent: '726' },
  {
    id: 'greek-key',
    name: 'Greek key',
    rows: ['111110', '100010', '101010', '101000', '101111'],
    main: '310',
    accent: '310',
  },
]

export function getBorder(id: string): BorderDef {
  return BORDERS.find((b) => b.id === id) ?? BORDERS[0]
}

export function borderHasAccent(def: BorderDef): boolean {
  return def.rows.some((r) => r.includes('2'))
}

export function defaultBorderColors(def: BorderDef): { main: StitchColor; accent: StitchColor } {
  return { main: byCode(def.main), accent: byCode(def.accent) }
}

export function normalizeMargins(margin: number | Partial<BorderMargins>): BorderMargins {
  if (typeof margin === 'number') {
    return { top: margin, bottom: margin, left: margin, right: margin }
  }
  const fallback = margin.top ?? margin.bottom ?? margin.left ?? margin.right ?? 0
  return {
    top: margin.top ?? fallback,
    bottom: margin.bottom ?? fallback,
    left: margin.left ?? fallback,
    right: margin.right ?? fallback,
  }
}

export function normalizeSides(sides?: Partial<BorderSides>): BorderSides {
  return {
    top: sides?.top ?? true,
    bottom: sides?.bottom ?? true,
    left: sides?.left ?? true,
    right: sides?.right ?? true,
  }
}

export function borderFits(
  def: BorderDef,
  width: number,
  height: number,
  margin: number | Partial<BorderMargins>,
  sidesInput?: Partial<BorderSides>,
): boolean {
  const t = def.rows.length
  const m = normalizeMargins(margin)
  const sides = normalizeSides(sidesInput)
  const reqW = (sides.left ? t : 0) + (sides.right ? t : 0)
  const reqH = (sides.top ? t : 0) + (sides.bottom ? t : 0)
  return width - m.left - m.right >= Math.max(reqW, t) && height - m.top - m.bottom >= Math.max(reqH, t)
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

type EdgePlan = { lead: number; run: number; phase: number }

// Plans one edge, as a stretch of `length` stitches between the corner squares. Plain tiles use the whole edge,
// mirror-symmetric about its center when possible, else centered. Tiles with a corner column tile motifs over a
// `run` that starts `lead` stitches in, padding either end with plain connecting line, so no motif is ever cut
// off at a corner; the plan uses as little padding as it can and keeps both ends balanced.
function planEdge(def: BorderDef, length: number): EdgePlan {
  const p = def.rows[0].length
  const isSymmetric = (o: number, run: number) =>
    def.rows.every((row) =>
      Array.from({ length: run }, (_, i) => row[mod(i + o, p)] === row[mod(run - 1 - i + o, p)]).every(Boolean),
    )
  if (def.corner === undefined) {
    const centered = Math.floor((p - length) / 2)
    const phase = [centered, ...Array.from({ length: p }, (_, i) => i)].find((o) => isSymmetric(o, length))
    return { lead: 0, run: length, phase: phase ?? centered }
  }

  const lineRow = def.rows.map((row) => !row.includes('0'))
  const motif = (col: number) => def.rows.filter((row, r) => !lineRow[r] && row[mod(col, p)] !== '0').length
  const plainFrom = (o: number, run: number, step: 1 | -1) => {
    let n = 0
    while (n < run && motif(step === 1 ? o + n : o + run - 1 - n) === 0) n++
    return n
  }

  let best: (EdgePlan & { cost: number }) | null = null
  for (let lead = 0; lead < p && lead <= length; lead++) {
    for (let trail = 0; trail < p && lead + trail <= length; trail++) {
      const run = length - lead - trail
      for (let o = 0; o < p; o++) {
        if (run > 0 && (motif(o) > 0 || motif(o + run - 1) > 0)) continue
        const before = lead + (run > 0 ? plainFrom(o, run, 1) : 0)
        const after = trail + (run > 0 ? plainFrom(o, run, -1) : 0)
        const cost = 2 * (lead + trail) + Math.abs(before - after) + (lead === trail && isSymmetric(o, run) ? 0 : 1)
        if (best === null || cost < best.cost) best = { lead, run, phase: o, cost }
      }
    }
  }
  return best ?? { lead: 0, run: 0, phase: 0 }
}

// Wraps the tile around the canvas edge, inset by `margin`. Corners are mitered: each cell takes the tile
// from whichever edge it is closest to, and the tile is centered on each edge so both ends match.
export function buildBorder(
  def: BorderDef,
  width: number,
  height: number,
  margin: number | Partial<BorderMargins>,
  main: StitchColor,
  accent: StitchColor,
  sidesInput?: Partial<BorderSides>,
): PixelObject | null {
  const m = normalizeMargins(margin)
  const sides = normalizeSides(sidesInput)
  if (!sides.top && !sides.bottom && !sides.left && !sides.right) return null
  if (!borderFits(def, width, height, m, sides)) return null

  const t = def.rows.length
  const p = def.rows[0].length
  const w = width - m.left - m.right
  const h = height - m.top - m.bottom
  const cells: PixelCell[] = []
  const inset = def.corner === undefined ? 0 : t
  const planH = planEdge(def, w - 2 * inset)
  const planV = planEdge(def, h - 2 * inset)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const activeCandidates: { side: number; d: number }[] = []
      if (sides.top && y < t) activeCandidates.push({ side: 0, d: y })
      if (sides.bottom && h - 1 - y < t) activeCandidates.push({ side: 1, d: h - 1 - y })
      if (sides.left && x < t) activeCandidates.push({ side: 2, d: x })
      if (sides.right && w - 1 - x < t) activeCandidates.push({ side: 3, d: w - 1 - x })

      if (activeCandidates.length === 0) continue

      activeCandidates.sort((a, b) => a.d - b.d)
      const { side, d } = activeCandidates[0]

      const horizontal = side < 2
      const row = side === 1 && def.upright ? t - 1 - d : d

      const inCorner =
        def.corner !== undefined &&
        ((side < 2 && ((sides.left && x < t) || (sides.right && w - 1 - x < t))) ||
          (side >= 2 && ((sides.top && y < t) || (sides.bottom && h - 1 - y < t))))

      const plan = horizontal ? planH : planV
      const along = (horizontal ? x : y) - inset - plan.lead
      const inRun = along >= 0 && along < plan.run
      const column = inCorner || !inRun ? def.corner! : mod(along + plan.phase, p)
      const ch = def.rows[row][column]
      if (ch === '0') continue
      cells.push({ dx: m.left + x, dy: m.top + y, color: ch === '2' ? accent : main })
    }
  }

  if (cells.length === 0) return null

  const minDx = Math.min(...cells.map((c) => c.dx))
  const minDy = Math.min(...cells.map((c) => c.dy))
  return {
    id: createId(),
    kind: 'pixels',
    x: minDx,
    y: minDy,
    hollow: true,
    borderMeta: {
      borderId: def.id,
      margins: m,
      sides,
      mainColor: main,
      accentColor: accent,
    },
    cells: cells.map((c) => ({ ...c, dx: c.dx - minDx, dy: c.dy - minDy })),
  }
}
