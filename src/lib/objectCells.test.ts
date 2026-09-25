import { describe, expect, it } from 'vitest'
import { renderObjectCells, rotateCells } from './objectCells'
import { measureObject } from './objectMeasure'
import { flattenProject } from './flattenProject'
import { createEmptyProject, type IconObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const color = DMC_STARTER_COLORS[0]
const key = (cells: { dx: number; dy: number }[]) => cells.map((c) => `${c.dx},${c.dy}`).sort()

// An L shape in a 3 wide x 2 tall box:
// X..
// XXX
const L = [
  { dx: 0, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
  { dx: 2, dy: 1 },
]

describe('rotateCells', () => {
  it('leaves 0° unchanged', () => {
    expect(rotateCells(L, 3, 2, 0)).toEqual(L)
  })

  it('rotates 90° clockwise into a 2 wide x 3 tall box', () => {
    // XX
    // X.
    // X.
    expect(key(rotateCells(L, 3, 2, 90))).toEqual(key([{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }]))
  })

  it('rotates 180°', () => {
    // XXX
    // ..X
    expect(key(rotateCells(L, 3, 2, 180))).toEqual(key([{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 2, dy: 1 }]))
  })

  it('rotates 270° clockwise', () => {
    // .X
    // .X
    // XX
    expect(key(rotateCells(L, 3, 2, 270))).toEqual(key([{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }]))
  })

  it('four quarter turns return to the original', () => {
    let cells = L
    let [w, h] = [3, 2]
    for (let i = 0; i < 4; i++) {
      cells = rotateCells(cells, w, h, 90)
      ;[w, h] = [h, w]
    }
    expect(key(cells)).toEqual(key(L))
  })
})

describe('rotated objects', () => {
  // rose is 9 wide x 13 tall, so a quarter turn visibly swaps the axes
  const rose: IconObject = { id: 'r', kind: 'icon', iconId: 'rose', scale: 1, x: 5, y: 5, rotation: 90, color }

  it('measures with width and height swapped at 90°/270°', () => {
    expect(measureObject({ ...rose, rotation: 0 })).toEqual({ width: 9, height: 13 })
    expect(measureObject(rose)).toEqual({ width: 13, height: 9 })
    expect(measureObject({ ...rose, rotation: 180 })).toEqual({ width: 9, height: 13 })
  })

  it('renders every rotated cell inside the rotated bounds', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const obj = { ...rose, rotation }
      const { width, height } = measureObject(obj)
      for (const c of renderObjectCells(obj)) {
        expect(c.dx).toBeGreaterThanOrEqual(0)
        expect(c.dx).toBeLessThan(width)
        expect(c.dy).toBeGreaterThanOrEqual(0)
        expect(c.dy).toBeLessThan(height)
      }
    }
  })

  it('exports the rotated shape, not the original', () => {
    const project = createEmptyProject('t')
    project.objects = [rose]
    const cells = flattenProject(project)
    expect(Math.max(...cells.map((c) => c.x)) - 5).toBe(12)
    expect(Math.max(...cells.map((c) => c.y)) - 5).toBe(8)
  })
})
