import type { CanvasObject } from './types'
import { measureObject } from './objectMeasure'
import { inkUnionBounds } from './inkBounds'

export type MirrorAxis = 'horizontal' | 'vertical'

// Flips the selection as one piece, in place: every object's stitches reflect about the
// middle of the group's actual stitches (not its declared box), so a single object stays
// where it visibly is and a group swaps sides like a reflection in a mirror. Objects
// whose declared box overhangs their ink can end up past a canvas edge, so the result
// is shifted back on as one rigid piece.
export function mirrorObjects(objects: CanvasObject[], axis: MirrorAxis, canvasWidth: number, canvasHeight: number): CanvasObject[] {
  const ink = inkUnionBounds(objects)
  if (!ink) return objects
  const horizontal = axis === 'horizontal'
  const twiceCenter = horizontal ? 2 * ink.x + ink.width : 2 * ink.y + ink.height

  const flipped = objects.map((o): CanvasObject => {
    const { width, height } = measureObject(o)
    const start = horizontal ? o.x : o.y
    const size = horizontal ? width : height
    const reflected = twiceCenter - start - size
    const position = horizontal ? { x: reflected } : { y: reflected }
    if (o.kind === 'pixels') {
      const cells = o.cells.map((c) => (horizontal ? { ...c, dx: width - 1 - c.dx } : { ...c, dy: height - 1 - c.dy }))
      return { ...o, ...position, cells }
    }
    const key = horizontal ? 'mirrorH' : 'mirrorV'
    return { ...o, ...position, [key]: o[key] ? undefined : true }
  })

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const o of flipped) {
    const { width, height } = measureObject(o)
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + width)
    maxY = Math.max(maxY, o.y + height)
  }
  const shiftX = minX < 0 ? -minX : Math.min(0, canvasWidth - maxX)
  const shiftY = minY < 0 ? -minY : Math.min(0, canvasHeight - maxY)
  if (shiftX === 0 && shiftY === 0) return flipped
  return flipped.map((o) => ({ ...o, x: o.x + shiftX, y: o.y + shiftY }))
}
