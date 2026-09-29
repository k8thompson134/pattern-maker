import { describe, expect, it } from 'vitest'
import { guideTargets, snapMove } from './snap'

const wide = { minDx: -100, maxDx: 100, minDy: -100, maxDy: 100 }

describe('snapMove', () => {
  const canvas = 60
  const targetsX = guideTargets(canvas, [], 'x')
  const targetsY = guideTargets(canvas, [], 'y')

  it('snaps a box near the canvas center onto it and reports the guide', () => {
    const box = { x: 10, y: 10, width: 10, height: 10 }
    const r = snapMove(box, targetsX, targetsY, 16, 0, wide, true)
    expect(box.x + r.dx).toBe(25)
    expect(r.guidesX).toContain(30)
  })

  it('snaps the left edge to the canvas edge', () => {
    const box = { x: 10, y: 10, width: 10, height: 10 }
    const r = snapMove(box, targetsX, targetsY, -9, 0, wide, true)
    expect(box.x + r.dx).toBe(0)
    expect(r.guidesX).toContain(0)
  })

  it('does not snap when far from every guide', () => {
    const box = { x: 10, y: 10, width: 4, height: 4 }
    const r = snapMove(box, targetsX, targetsY, 7, 3, wide, true)
    expect(r.dx).toBe(7)
  })

  it('snaps to another object edge and middle', () => {
    const other = { x: 40, y: 20, width: 8, height: 8 }
    const tx = guideTargets(canvas, [other], 'x')
    const box = { x: 0, y: 0, width: 6, height: 6 }
    const r = snapMove(box, tx, targetsY, 39, 0, wide, true)
    expect(box.x + r.dx).toBe(40)
    expect(r.guidesX).toContain(40)
  })

  it('leaves the drag untouched when disabled', () => {
    const box = { x: 10, y: 10, width: 10, height: 10 }
    const r = snapMove(box, targetsX, targetsY, 16, 0, wide, false)
    expect(r).toEqual({ dx: 16, dy: 0, guidesX: [], guidesY: [] })
  })

  it('never pushes a snap outside the drag limits', () => {
    const box = { x: 10, y: 10, width: 10, height: 10 }
    const r = snapMove(box, targetsX, targetsY, 14, 0, { ...wide, maxDx: 14 }, true)
    expect(r.dx).toBe(14)
  })
})
