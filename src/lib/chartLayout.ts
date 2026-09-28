import type { ColorUsage } from './flattenProject'

// Helvetica-safe (WinAnsi) glyphs, skipping look-alikes (O/0, I/1/l, S/5, Z/2, B/8).
const SYMBOLS = [...'+x*#@%&=?ACEFHKLMNPRTUVWY3479<>/~$']
const OVERFLOW_LETTERS = [...'ACEFHKLMNPRTUVWY']

export const MIN_SINGLE_PAGE_CELL_MM = 2.5
export const MAX_CELL_MM = 6
export const TILE_CELL_MM = 4
export const GRID_MAJOR_EVERY = 10

// One distinct symbol per color, in the given (usage) order. Past the single-
// character set, falls back to two-letter codes so every color stays distinct.
export function assignSymbols(colors: ColorUsage[]): Map<string, string> {
  const out = new Map<string, string>()
  colors.forEach((c, i) => {
    if (i < SYMBOLS.length) {
      out.set(c.color.dmcCode, SYMBOLS[i])
      return
    }
    const j = i - SYMBOLS.length
    const a = OVERFLOW_LETTERS[Math.floor(j / OVERFLOW_LETTERS.length) % OVERFLOW_LETTERS.length]
    const b = OVERFLOW_LETTERS[j % OVERFLOW_LETTERS.length]
    out.set(c.color.dmcCode, a + b)
  })
  return out
}

export function symbolTextIsBlack(hex: string): boolean {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

// Half-open stitch ranges: columns x0..x1-1, rows y0..y1-1.
export type ChartTile = { x0: number; y0: number; x1: number; y1: number }

export type ChartPlan = {
  cellSize: number
  tiles: ChartTile[]
}

export type PageBox = {
  pageWidth: number
  pageHeight: number
  margin: number
  headerHeight: number
  // Space reserved left of / above the grid for row/column numbers.
  gutter: number
}

// Fits the whole grid on one page if cells stay at least MIN_SINGLE_PAGE_CELL_MM;
// otherwise tiles it into pages at TILE_CELL_MM, with tile edges on multiples of
// GRID_MAJOR_EVERY so page breaks land on the heavy gridlines stitchers count by.
export function planChart(width: number, height: number, page: PageBox): ChartPlan {
  const singleW = page.pageWidth - page.margin * 2 - page.gutter
  const singleH = page.pageHeight - page.margin * 2 - page.headerHeight - page.gutter
  const fit = Math.min(singleW / width, singleH / height, MAX_CELL_MM)
  if (fit >= MIN_SINGLE_PAGE_CELL_MM) {
    return { cellSize: fit, tiles: [{ x0: 0, y0: 0, x1: width, y1: height }] }
  }

  const tileW = page.pageWidth - page.margin * 2 - page.gutter
  const tileH = page.pageHeight - page.margin * 2 - page.headerHeight - page.gutter
  const cols = Math.max(GRID_MAJOR_EVERY, Math.floor(tileW / TILE_CELL_MM / GRID_MAJOR_EVERY) * GRID_MAJOR_EVERY)
  const rows = Math.max(GRID_MAJOR_EVERY, Math.floor(tileH / TILE_CELL_MM / GRID_MAJOR_EVERY) * GRID_MAJOR_EVERY)
  const tiles: ChartTile[] = []
  for (let y0 = 0; y0 < height; y0 += rows) {
    for (let x0 = 0; x0 < width; x0 += cols) {
      tiles.push({ x0, y0, x1: Math.min(x0 + cols, width), y1: Math.min(y0 + rows, height) })
    }
  }
  return { cellSize: TILE_CELL_MM, tiles }
}

// Grid-line indices (0..n) that get a heavy line and a number.
export function majorLines(from: number, to: number): number[] {
  const out: number[] = []
  const first = Math.ceil(from / GRID_MAJOR_EVERY) * GRID_MAJOR_EVERY
  for (let i = first; i <= to; i += GRID_MAJOR_EVERY) out.push(i)
  return out
}

// The center as a grid-line coordinate: a line for even sizes, mid-stitch for odd.
export function centerLine(size: number): number {
  return size / 2
}
