import { describe, expect, it } from 'vitest'
import { BORDERS, borderFits, buildBorder, defaultBorderColors } from './borders'
import { measureObject } from './objectMeasure'
import type { StitchColor } from './types'

const main: StitchColor = { dmcCode: '310', name: 'Black', hex: '#000000' }
const accent: StitchColor = { dmcCode: '666', name: 'Red', hex: '#e31d42' }

function absolute(def: (typeof BORDERS)[number], w: number, h: number, margin = 0) {
  const b = buildBorder(def, w, h, margin, main, accent)!
  return b.cells.map((c) => ({ x: b.x + c.dx, y: b.y + c.dy, color: c.color }))
}

describe('borders', () => {
  it('every tile has equal-width rows and resolvable default colors', () => {
    for (const def of BORDERS) {
      expect(new Set(def.rows.map((r) => r.length)).size).toBe(1)
      expect(() => defaultBorderColors(def)).not.toThrow()
    }
  })

  it('a solid line covers exactly the perimeter', () => {
    const cells = absolute(BORDERS[0], 10, 8)
    expect(cells).toHaveLength(2 * 10 + 2 * 8 - 4)
    expect(cells.every((c) => c.x === 0 || c.y === 0 || c.x === 9 || c.y === 7)).toBe(true)
  })

  it('margin insets the border and stays inside the canvas', () => {
    const cells = absolute(BORDERS[0], 12, 12, 2)
    expect(Math.min(...cells.map((c) => c.x))).toBe(2)
    expect(Math.max(...cells.map((c) => c.x))).toBe(9)
    expect(Math.min(...cells.map((c) => c.y))).toBe(2)
    expect(Math.max(...cells.map((c) => c.y))).toBe(9)
  })

  it('keeps the pixel-object invariants and is hollow', () => {
    for (const def of BORDERS) {
      const b = buildBorder(def, 40, 30, 1, main, accent)!
      expect(b.hollow).toBe(true)
      expect(Math.min(...b.cells.map((c) => c.dx))).toBe(0)
      expect(Math.min(...b.cells.map((c) => c.dy))).toBe(0)
      const size = measureObject(b)
      expect(b.x + size.width).toBeLessThanOrEqual(40)
      expect(b.y + size.height).toBeLessThanOrEqual(30)
    }
  })

  it('uses the accent color only for accent cells', () => {
    const vine = BORDERS.find((d) => d.id === 'vine')!
    const colors = new Set(absolute(vine, 40, 30).map((c) => c.color.dmcCode))
    expect(colors).toEqual(new Set(['310', '666']))
    const line = new Set(absolute(BORDERS[0], 40, 30).map((c) => c.color.dmcCode))
    expect(line).toEqual(new Set(['310']))
  })

  it('is left-right symmetric on the top edge', () => {
    for (const def of BORDERS) {
      const top = new Set(absolute(def, 41, 30).filter((c) => c.y < def.rows.length).map((c) => `${c.x},${c.y}`))
      const flipped = [...top].map((k) => {
        const [x, y] = k.split(',').map(Number)
        return `${40 - x},${y}`
      })
      if (['greek-key', 'checker', 'vine'].includes(def.id)) continue
      expect([def.id, flipped.every((k) => top.has(k))]).toEqual([def.id, true])
    }
  })

  it('returns null when the canvas is too small', () => {
    const vine = BORDERS.find((d) => d.id === 'vine')!
    expect(borderFits(vine, 9, 9, 0)).toBe(false)
    expect(buildBorder(vine, 9, 9, 0, main, accent)).toBeNull()
    expect(borderFits(vine, 20, 20, 6)).toBe(false)
  })
})

describe('border corners', () => {
  it('motif styles use a plain line column for the corners', () => {
    for (const def of BORDERS.filter((d) => d.corner !== undefined)) {
      const lineRows = def.rows.map((row) => !row.includes('0'))
      const filled = def.rows.map((row) => row[def.corner!] !== '0')
      expect(filled.some(Boolean)).toBe(true)
      expect(filled.every((f, r) => !f || lineRows[r])).toBe(true)
    }
  })

  it('never cuts a motif off at the ends of an edge, for odd and even lengths', () => {
    const hearts = BORDERS.find((d) => d.id === 'hearts')!
    for (const size of [40, 41, 42, 58, 59]) {
      const cells = absolute(hearts, size, size)
      const t = hearts.rows.length
      for (const c of cells) {
        const nearEnd = c.y < t && (c.x === t || c.x === size - 1 - t)
        if (nearEnd && c.color.dmcCode === '310') expect(c.y).toBe(1)
      }
    }
  })
})
