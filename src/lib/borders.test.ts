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
      if (['greek-key', 'checker', 'vine'].includes(def.id) || def.corner !== undefined) continue
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

describe('border sizes', () => {
  it('builds inside the canvas with no duplicate stitches at every size and margin', () => {
    for (const def of BORDERS) {
      for (let w = 1; w <= 60; w++) {
        for (let h = 1; h <= 60; h += 7) {
          for (const margin of [0, 1, 3]) {
            const b = buildBorder(def, w, h, margin, main, accent)
            expect(b !== null).toBe(borderFits(def, w, h, margin))
            if (!b) continue
            const xs = b.cells.map((q) => b.x + q.dx)
            const ys = b.cells.map((q) => b.y + q.dy)
            expect(Math.min(...xs)).toBeGreaterThanOrEqual(margin)
            expect(Math.max(...xs)).toBeLessThanOrEqual(w - 1 - margin)
            expect(Math.min(...ys)).toBeGreaterThanOrEqual(margin)
            expect(Math.max(...ys)).toBeLessThanOrEqual(h - 1 - margin)
            expect(new Set(b.cells.map((q) => `${q.dx},${q.dy}`)).size).toBe(b.cells.length)
          }
        }
      }
    }
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

  it('never cuts a motif off beside a corner, at any canvas size', () => {
    for (const def of BORDERS.filter((d) => d.corner !== undefined)) {
      const t = def.rows.length
      const lineRow = def.rows.map((row) => !row.includes('0'))
      for (let size = 2 * t + 2 * (def.rows[0].length + t); size <= 90; size++) {
        for (const c of absolute(def, size, size + 3)) {
          const besideCorner = c.y < t && (c.x === t || c.x === size - 1 - t)
          const besideCornerSide = c.x < t && (c.y === t || c.y === size + 2 - t)
          if (besideCorner) expect([def.id, size, lineRow[c.y]]).toEqual([def.id, size, true])
          if (besideCornerSide) expect([def.id, size, lineRow[c.x]]).toEqual([def.id, size, true])
        }
      }
    }
  })
})
