import { describe, expect, it } from 'vitest'
import { createEmptyPixelObject, eraseCell, paintCell } from './pixelObject'
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
