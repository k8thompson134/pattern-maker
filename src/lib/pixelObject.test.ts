import { describe, expect, it } from 'vitest'
import { createEmptyPixelObject, eraseCell, eraseCells, lineCells, paintCell, paintCells } from './pixelObject'
import { DMC_STARTER_COLORS } from './dmcColors'

const red = DMC_STARTER_COLORS[2]
const blue = DMC_STARTER_COLORS[5]

describe('paintCell', () => {
  it('anchors x/y at the first painted cell', () => {
    const obj = paintCell(createEmptyPixelObject(), 10, 15, red)
    expect(obj.x).toBe(10)
    expect(obj.y).toBe(15)
    expect(obj.cells).toEqual([{ dx: 0, dy: 0, color: red }])
  })

  it('keeps x/y fixed when a second cell is painted to the right/below', () => {
    let obj = paintCell(createEmptyPixelObject(), 10, 15, red)
    obj = paintCell(obj, 12, 17, blue)
    expect(obj.x).toBe(10)
    expect(obj.y).toBe(15)
    expect(obj.cells).toContainEqual({ dx: 0, dy: 0, color: red })
    expect(obj.cells).toContainEqual({ dx: 2, dy: 2, color: blue })
  })

  it('rebases x/y left when painting to the left of the current anchor', () => {
    let obj = paintCell(createEmptyPixelObject(), 10, 15, red)
    obj = paintCell(obj, 7, 15, blue) // 3 stitches left of the first cell
    expect(obj.x).toBe(7)
    expect(obj.y).toBe(15)
    // the original cell's dx must shift so its absolute position is unchanged
    expect(obj.cells).toContainEqual({ dx: 3, dy: 0, color: red })
    expect(obj.cells).toContainEqual({ dx: 0, dy: 0, color: blue })
  })

  it('rebases x/y up when painting above the current anchor', () => {
    let obj = paintCell(createEmptyPixelObject(), 10, 15, red)
    obj = paintCell(obj, 10, 12, blue) // 3 stitches above
    expect(obj.y).toBe(12)
    expect(obj.x).toBe(10)
    expect(obj.cells).toContainEqual({ dx: 0, dy: 3, color: red })
    expect(obj.cells).toContainEqual({ dx: 0, dy: 0, color: blue })
  })

  it('never produces a negative dx or dy no matter the paint order', () => {
    let obj = createEmptyPixelObject()
    const points: [number, number][] = [
      [10, 10],
      [5, 20],
      [20, 5],
      [0, 0],
      [15, 15],
    ]
    for (const [gx, gy] of points) {
      obj = paintCell(obj, gx, gy, red)
    }
    for (const c of obj.cells) {
      expect(c.dx).toBeGreaterThanOrEqual(0)
      expect(c.dy).toBeGreaterThanOrEqual(0)
    }
    // every absolute position should round-trip back to what was painted
    const absolutePoints = obj.cells.map((c) => [obj.x + c.dx, obj.y + c.dy])
    for (const [gx, gy] of points) {
      expect(absolutePoints).toContainEqual([gx, gy])
    }
  })

  it('repainting the same cell with a new color replaces it, not duplicates it', () => {
    let obj = paintCell(createEmptyPixelObject(), 5, 5, red)
    obj = paintCell(obj, 5, 5, blue)
    expect(obj.cells.length).toBe(1)
    expect(obj.cells[0].color).toBe(blue)
  })
})

describe('eraseCell', () => {
  it('removes exactly the targeted cell', () => {
    let obj = paintCell(createEmptyPixelObject(), 5, 5, red)
    obj = paintCell(obj, 6, 5, blue)
    obj = eraseCell(obj, 5, 5)
    expect(obj.cells.length).toBe(1)
    expect(obj.x + obj.cells[0].dx).toBe(6)
  })

  it('rebases the anchor after erasing the top-left-most cell', () => {
    let obj = paintCell(createEmptyPixelObject(), 5, 5, red)
    obj = paintCell(obj, 6, 5, blue)
    obj = eraseCell(obj, 5, 5) // remove the cell that was the anchor
    expect(obj.x).toBe(6)
    expect(obj.cells).toEqual([{ dx: 0, dy: 0, color: blue }])
  })

  it('erasing the last cell returns an empty, reset object', () => {
    let obj = paintCell(createEmptyPixelObject(), 5, 5, red)
    obj = eraseCell(obj, 5, 5)
    expect(obj.cells).toEqual([])
    expect(obj.x).toBe(0)
    expect(obj.y).toBe(0)
  })

  it('erasing a point that was never painted is a no-op', () => {
    const obj = paintCell(createEmptyPixelObject(), 5, 5, red)
    const erased = eraseCell(obj, 99, 99)
    expect(erased.cells).toEqual(obj.cells)
    expect(erased.x).toBe(obj.x)
    expect(erased.y).toBe(obj.y)
  })
})

describe('paintCells / eraseCells', () => {
  it('paints a batch and rebases once to the true top-left', () => {
    const obj = paintCells(createEmptyPixelObject(), [{ gx: 12, gy: 9 }, { gx: 10, gy: 11 }, { gx: 11, gy: 10 }], red)
    expect(obj.x).toBe(10)
    expect(obj.y).toBe(9)
    expect(obj.cells).toHaveLength(3)
    expect(obj.cells).toContainEqual({ dx: 2, dy: 0, color: red })
    expect(obj.cells).toContainEqual({ dx: 0, dy: 2, color: red })
  })

  it('repainting an existing cell replaces its color instead of duplicating it', () => {
    let obj = paintCells(createEmptyPixelObject(), [{ gx: 3, gy: 3 }], red)
    obj = paintCells(obj, [{ gx: 3, gy: 3 }, { gx: 4, gy: 3 }], blue)
    expect(obj.cells).toHaveLength(2)
    expect(obj.cells).toContainEqual({ dx: 0, dy: 0, color: blue })
  })

  it('erases a batch and empties out to the origin', () => {
    const painted = paintCells(createEmptyPixelObject(), [{ gx: 5, gy: 5 }, { gx: 6, gy: 5 }], red)
    const partial = eraseCells(painted, [{ gx: 5, gy: 5 }])
    expect(partial.x).toBe(6)
    expect(partial.cells).toEqual([{ dx: 0, dy: 0, color: red }])
    const empty = eraseCells(partial, [{ gx: 6, gy: 5 }, { gx: 99, gy: 99 }])
    expect(empty.cells).toEqual([])
  })

  it('keeps other fields like groupId when painting and erasing', () => {
    const grouped = { ...paintCells(createEmptyPixelObject(), [{ gx: 1, gy: 1 }], red), groupId: 'g1' }
    expect(paintCells(grouped, [{ gx: 2, gy: 1 }], red).groupId).toBe('g1')
    expect(eraseCells(grouped, [{ gx: 1, gy: 1 }]).groupId).toBe('g1')
  })
})

describe('lineCells', () => {
  it('returns just the cell when the endpoints match', () => {
    expect(lineCells({ gx: 4, gy: 4 }, { gx: 4, gy: 4 })).toEqual([{ gx: 4, gy: 4 }])
  })

  it('fills a horizontal run in order, ends included', () => {
    expect(lineCells({ gx: 2, gy: 7 }, { gx: 5, gy: 7 })).toEqual([
      { gx: 2, gy: 7 },
      { gx: 3, gy: 7 },
      { gx: 4, gy: 7 },
      { gx: 5, gy: 7 },
    ])
  })

  it('never skips a cell: each step moves at most one cell, in every direction', () => {
    const ends = [
      { gx: 9, gy: 2 },
      { gx: -6, gy: 5 },
      { gx: 3, gy: -8 },
      { gx: -4, gy: -7 },
      { gx: 1, gy: 12 },
    ]
    for (const to of ends) {
      const line = lineCells({ gx: 0, gy: 0 }, to)
      expect(line[0]).toEqual({ gx: 0, gy: 0 })
      expect(line[line.length - 1]).toEqual(to)
      for (let i = 1; i < line.length; i++) {
        expect(Math.abs(line[i].gx - line[i - 1].gx)).toBeLessThanOrEqual(1)
        expect(Math.abs(line[i].gy - line[i - 1].gy)).toBeLessThanOrEqual(1)
      }
    }
  })
})
