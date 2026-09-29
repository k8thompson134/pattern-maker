import { createId } from './id'
import { byCode } from './iconColors'
import type { PixelCell, PixelObject, StitchColor } from './types'

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

export function borderHasAccent(def: BorderDef): boolean {
  return def.rows.some((r) => r.includes('2'))
}

export function defaultBorderColors(def: BorderDef): { main: StitchColor; accent: StitchColor } {
  return { main: byCode(def.main), accent: byCode(def.accent) }
}

export function borderFits(def: BorderDef, width: number, height: number, margin: number): boolean {
  const t = def.rows.length
  return width - 2 * margin >= 2 * t && height - 2 * margin >= 2 * t
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

// Picks the tile phase for one run of stitches. Plain tiles are mirror-symmetric about the run's center when
// possible, else centered. Tiles with a corner column instead prefer both ends to land on plain connecting line
// (no motif cut off at a corner), then symmetry.
function edgePhase(def: BorderDef, length: number): number {
  const p = def.rows[0].length
  const centered = Math.floor((p - length) / 2)
  const candidates = [centered, ...Array.from({ length: p }, (_, i) => i)]
  const isSymmetric = (o: number) =>
    def.rows.every((row) =>
      Array.from({ length }, (_, i) => row[mod(i + o, p)] === row[mod(length - 1 - i + o, p)]).every(Boolean),
    )
  if (def.corner === undefined) return candidates.find(isSymmetric) ?? centered

  const lineRow = def.rows.map((row) => !row.includes('0'))
  const motifCells = (col: number) =>
    def.rows.filter((row, r) => !lineRow[r] && row[mod(col, p)] !== '0').length
  const cost = (o: number) => 2 * (motifCells(o) + motifCells(o + length - 1)) + (isSymmetric(o) ? 0 : 1)
  return candidates.reduce((best, o) => (cost(o) < cost(best) ? o : best))
}

// Wraps the tile around the canvas edge, inset by `margin`. Corners are mitered: each cell takes the tile
// from whichever edge it is closest to, and the tile is centered on each edge so both ends match.
export function buildBorder(
  def: BorderDef,
  width: number,
  height: number,
  margin: number,
  main: StitchColor,
  accent: StitchColor,
): PixelObject | null {
  if (!borderFits(def, width, height, margin)) return null
  const t = def.rows.length
  const p = def.rows[0].length
  const w = width - 2 * margin
  const h = height - 2 * margin
  const cells: PixelCell[] = []
  const inset = def.corner === undefined ? 0 : t
  const phaseH = edgePhase(def, w - 2 * inset)
  const phaseV = edgePhase(def, h - 2 * inset)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distances = [y, h - 1 - y, x, w - 1 - x]
      const d = Math.min(...distances)
      if (d >= t) continue
      const side = distances.indexOf(d)
      const horizontal = side < 2
      const row = side === 1 && def.upright ? t - 1 - d : d
      const inCorner = def.corner !== undefined && Math.min(x, w - 1 - x) < t && Math.min(y, h - 1 - y) < t
      const along = (horizontal ? x : y) - inset
      const column = inCorner ? def.corner! : mod(along + (horizontal ? phaseH : phaseV), p)
      const ch = def.rows[row][column]
      if (ch === '0') continue
      cells.push({ dx: x, dy: y, color: ch === '2' ? accent : main })
    }
  }

  const minDx = Math.min(...cells.map((c) => c.dx))
  const minDy = Math.min(...cells.map((c) => c.dy))
  return {
    id: createId(),
    kind: 'pixels',
    x: margin + minDx,
    y: margin + minDy,
    hollow: true,
    cells: cells.map((c) => ({ ...c, dx: c.dx - minDx, dy: c.dy - minDy })),
  }
}
