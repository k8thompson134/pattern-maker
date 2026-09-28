import { describe, expect, it } from 'vitest'
import { assignSymbols, centerLine, majorLines, planChart, symbolTextIsBlack, TILE_CELL_MM } from './chartLayout'
import type { PageBox } from './chartLayout'
import { DMC_STARTER_COLORS } from './dmcColors'

const a4Portrait: PageBox = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 12,
  headerHeight: 8,
  gutter: 6,
}

describe('assignSymbols', () => {
  it('gives every color a distinct symbol, including past the single-character set', () => {
    const colors = Array.from({ length: 120 }, (_, i) => ({
      color: { ...DMC_STARTER_COLORS[0], dmcCode: `c${i}` },
      count: 1,
    }))
    const symbols = assignSymbols(colors)
    expect(symbols.size).toBe(120)
    expect(new Set(symbols.values()).size).toBe(120)
  })

  it('is deterministic for the same input order', () => {
    const colors = DMC_STARTER_COLORS.slice(0, 5).map((color, i) => ({ color, count: 10 - i }))
    expect([...assignSymbols(colors)]).toEqual([...assignSymbols(colors)])
  })
})

describe('symbolTextIsBlack', () => {
  it('uses black on light fills and white on dark fills', () => {
    expect(symbolTextIsBlack('#ffffff')).toBe(true)
    expect(symbolTextIsBlack('#000000')).toBe(false)
  })
})

describe('planChart', () => {
  it('keeps a small design on a single page', () => {
    const plan = planChart(60, 60, a4Portrait)
    expect(plan.tiles).toEqual([{ x0: 0, y0: 0, x1: 60, y1: 60 }])
  })

  it('tiles a large design at a fixed cell size with tile edges on multiples of 10', () => {
    const plan = planChart(200, 150, a4Portrait)
    expect(plan.cellSize).toBe(TILE_CELL_MM)
    expect(plan.tiles.length).toBeGreaterThan(1)
    for (const t of plan.tiles) {
      expect(t.x0 % 10).toBe(0)
      expect(t.y0 % 10).toBe(0)
    }
  })

  it('covers every stitch exactly once', () => {
    const w = 173
    const h = 121
    const plan = planChart(w, h, a4Portrait)
    let area = 0
    for (const t of plan.tiles) area += (t.x1 - t.x0) * (t.y1 - t.y0)
    expect(area).toBe(w * h)
  })

  it('never lets a tile exceed the printable area', () => {
    const plan = planChart(300, 300, a4Portrait)
    for (const t of plan.tiles) {
      expect((t.x1 - t.x0) * plan.cellSize).toBeLessThanOrEqual(210 - 24 - 6)
      expect((t.y1 - t.y0) * plan.cellSize).toBeLessThanOrEqual(297 - 24 - 8 - 6)
    }
  })
})

describe('majorLines / centerLine', () => {
  it('lists heavy-line indices inside a range, inclusive of both ends', () => {
    expect(majorLines(0, 30)).toEqual([0, 10, 20, 30])
    expect(majorLines(5, 25)).toEqual([10, 20])
  })

  it('centers on a line for even sizes and mid-stitch for odd sizes', () => {
    expect(centerLine(60)).toBe(30)
    expect(centerLine(61)).toBe(30.5)
  })
})
