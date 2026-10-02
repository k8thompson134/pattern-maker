import { describe, expect, it } from 'vitest'
import {
  brushOffsets,
  createEmptyPixelObject,
  eraseCell,
  eraseCells,
  expandByBrush,
  floodFillCells,
  lineCells,
  paintCell,
  paintCells,
  rectangleCells,
  straightLineCells,
} from './pixelObject'
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

describe('straightLineCells', () => {
  it('snaps mostly-horizontal to purely horizontal', () => {
    const line = straightLineCells({ gx: 0, gy: 5 }, { gx: 10, gy: 6 }, true)
    expect(line.every((c) => c.gy === 5)).toBe(true)
    expect(line[0]).toEqual({ gx: 0, gy: 5 })
    expect(line[line.length - 1]).toEqual({ gx: 10, gy: 5 })
  })

  it('snaps mostly-vertical to purely vertical', () => {
    const line = straightLineCells({ gx: 5, gy: 0 }, { gx: 6, gy: 10 }, true)
    expect(line.every((c) => c.gx === 5)).toBe(true)
    expect(line[0]).toEqual({ gx: 5, gy: 0 })
    expect(line[line.length - 1]).toEqual({ gx: 5, gy: 10 })
  })

  it('snaps roughly 45 degrees to a 1:1 diagonal', () => {
    const line = straightLineCells({ gx: 0, gy: 0 }, { gx: 5, gy: 6 }, true)
    // Snaps to equal distance in dx and dy
    const last = line[line.length - 1]
    expect(Math.abs(last.gx)).toBe(Math.abs(last.gy))
  })
})

describe('brushOffsets and expandByBrush', () => {
  it('size 1 returns a single offset at origin', () => {
    expect(brushOffsets(1)).toEqual([{ ox: 0, oy: 0 }])
    const single = expandByBrush([{ gx: 5, gy: 5 }], 1)
    expect(single).toEqual([{ gx: 5, gy: 5 }])
  })

  it('size 2 returns a 2x2 cluster (4 cells)', () => {
    const offsets = brushOffsets(2)
    expect(offsets).toHaveLength(4)
    const expanded = expandByBrush([{ gx: 10, gy: 10 }], 2)
    expect(expanded).toHaveLength(4)
  })

  it('size 3 returns a 3x3 footprint (9 cells)', () => {
    const offsets = brushOffsets(3)
    expect(offsets).toHaveLength(9)
    const expanded = expandByBrush([{ gx: 0, gy: 0 }], 3)
    expect(expanded).toHaveLength(9)
  })

  it('expandByBrush deduplicates overlapping strokes', () => {
    const stroke = [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }]
    const expanded = expandByBrush(stroke, 2)
    // 2x2 on adjacent cells overlaps by 2, so 4 + 4 - 2 = 6 unique cells
    expect(expanded).toHaveLength(6)
  })
})

describe('rectangleCells', () => {
  it('fills all cells within a bounding box regardless of corner drag order', () => {
    const cells1 = rectangleCells({ gx: 2, gy: 3 }, { gx: 4, gy: 5 })
    const cells2 = rectangleCells({ gx: 4, gy: 5 }, { gx: 2, gy: 3 })
    expect(cells1).toHaveLength(3 * 3) // (4-2+1) * (5-3+1) = 9
    expect(cells2).toHaveLength(9)
    expect(cells1).toContainEqual({ gx: 2, gy: 3 })
    expect(cells1).toContainEqual({ gx: 4, gy: 5 })
    expect(cells1).toContainEqual({ gx: 3, gy: 4 })
  })
})

describe('floodFillCells', () => {
  it('fills an enclosed area stopped by an outline boundary', () => {
    // 5x5 grid with a border of walls at x=0, x=4, y=0, y=4
    const walls = new Set<string>()
    for (let x = 0; x <= 4; x++) {
      walls.add(`${x},0`)
      walls.add(`${x},4`)
    }
    for (let y = 0; y <= 4; y++) {
      walls.add(`0,${y}`)
      walls.add(`4,${y}`)
    }

    const colorAt = (gx: number, gy: number) => (walls.has(`${gx},${gy}`) ? '310' : null)

    // Seed inside the enclosed area at (2, 2)
    const filled = floodFillCells({ gx: 2, gy: 2 }, 5, 5, colorAt)
    // The interior is a 3x3 block: x in 1..3, y in 1..3 => 9 cells
    expect(filled).toHaveLength(9)
    expect(filled.every((c) => !walls.has(`${c.gx},${c.gy}`))).toBe(true)
  })

  it('stops if seed is on the canvas boundary or out of bounds', () => {
    const colorAt = () => null
    expect(floodFillCells({ gx: -1, gy: 0 }, 5, 5, colorAt)).toEqual([])
  })
})
