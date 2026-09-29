import { describe, expect, it } from 'vitest'
import { mirrorObjects } from './mirror'
import { renderObjectCells } from './objectCells'
import { inkBounds, inkUnionBounds } from './inkBounds'
import { measureObject } from './objectMeasure'
import { DMC_STARTER_COLORS } from './dmcColors'
import type { CanvasObject, IconObject, PixelObject, TextObject } from './types'

const color = DMC_STARTER_COLORS[0]

const icon = (over: Partial<IconObject> = {}): IconObject => ({
  id: 'i', kind: 'icon', iconId: 'moon', scale: 1, x: 10, y: 12, rotation: 0, color, ...over,
})
const word = (over: Partial<TextObject> = {}): TextObject => ({
  id: 't', kind: 'text', content: 'Tea', font: 'mixed-5x9', direction: 'horizontal', scale: 1, x: 8, y: 20, rotation: 0, color, ...over,
})
const drawing: PixelObject = {
  id: 'p', kind: 'pixels', x: 5, y: 6,
  cells: [{ dx: 0, dy: 0, color }, { dx: 1, dy: 0, color }, { dx: 2, dy: 1, color }, { dx: 0, dy: 2, color }],
}

function stitches(objs: CanvasObject[]): string[] {
  return objs
    .flatMap((o) => (o.kind === 'pixels' ? o.cells : renderObjectCells(o)).map((c) => `${o.x + c.dx},${o.y + c.dy}`))
    .sort()
}

describe('mirrorObjects', () => {
  const subjects: [string, CanvasObject][] = [
    ['icon', icon()],
    ['rotated icon', icon({ rotation: 90 })],
    ['scaled text', word({ scale: 2, rotation: 270 })],
    ['drawing', drawing],
  ]

  it.each(subjects)('flipping twice restores the %s exactly', (_name, obj) => {
    for (const axis of ['horizontal', 'vertical'] as const) {
      const once = mirrorObjects([obj], axis, 60, 60)
      const twice = mirrorObjects(once, axis, 60, 60)
      expect(stitches(twice)).toEqual(stitches([obj]))
    }
  })

  it.each(subjects)('a flipped %s stays in place and reflects its stitches', (_name, obj) => {
    const before = inkBounds(obj)
    const [after] = mirrorObjects([obj], 'horizontal', 60, 60)
    expect(inkBounds(after)).toEqual(before)
    const reflected = stitches([obj])
      .map((s) => s.split(',').map(Number))
      .map(([x, y]) => `${2 * before.x + before.width - 1 - x},${y}`)
      .sort()
    expect(stitches([after])).toEqual(reflected)
  })

  it('reflects a vertical flip of an asymmetric icon', () => {
    const before = inkBounds(icon())
    const [after] = mirrorObjects([icon()], 'vertical', 60, 60)
    const reflected = stitches([icon()])
      .map((s) => s.split(',').map(Number))
      .map(([x, y]) => `${x},${2 * before.y + before.height - 1 - y}`)
      .sort()
    expect(stitches([after])).toEqual(reflected)
  })

  it('swaps a group across its shared middle', () => {
    const left = icon({ id: 'l', x: 5, y: 10 })
    const right = icon({ id: 'r', iconId: 'heart', x: 30, y: 10 })
    const [l2, r2] = mirrorObjects([left, right], 'horizontal', 60, 60)
    expect(inkBounds(l2).x).toBeGreaterThan(inkBounds(r2).x)
    expect(inkUnionBounds([l2, r2])).toEqual(inkUnionBounds([left, right]))
  })

  it('keeps every box on the canvas when the ink touches an edge', () => {
    const edge = icon({ x: 0, y: 0 })
    for (const axis of ['horizontal', 'vertical'] as const) {
      const [m] = mirrorObjects([edge], axis, 60, 60)
      const { width, height } = measureObject(m)
      expect(m.x).toBeGreaterThanOrEqual(0)
      expect(m.y).toBeGreaterThanOrEqual(0)
      expect(m.x + width).toBeLessThanOrEqual(60)
      expect(m.y + height).toBeLessThanOrEqual(60)
    }
  })

  it('toggles the flag off instead of leaving false behind', () => {
    const once = mirrorObjects([icon()], 'horizontal', 60, 60)[0] as IconObject
    expect(once.mirrorH).toBe(true)
    const twice = mirrorObjects([once], 'horizontal', 60, 60)[0] as IconObject
    expect(twice.mirrorH).toBeFalsy()
  })
})
