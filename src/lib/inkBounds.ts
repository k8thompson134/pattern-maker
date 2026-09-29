import type { CanvasObject } from './types'
import { renderObjectCells } from './objectCells'
import { measureObject } from './objectMeasure'
import type { Bounds } from './selection'

// The box around an object's actual stitches. `measureObject` is the declared box,
// which includes blank columns/rows some icons carry and the empty rows above or
// below a lowercase word — aligning by that box looks off-center.
export function inkBounds(obj: CanvasObject): Bounds {
  const cells = obj.kind === 'pixels' ? obj.cells : renderObjectCells(obj)
  if (cells.length === 0) {
    const { width, height } = measureObject(obj)
    return { x: obj.x, y: obj.y, width, height }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of cells) {
    minX = Math.min(minX, c.dx)
    minY = Math.min(minY, c.dy)
    maxX = Math.max(maxX, c.dx)
    maxY = Math.max(maxY, c.dy)
  }
  return { x: obj.x + minX, y: obj.y + minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function inkUnionBounds(objects: CanvasObject[]): Bounds | null {
  if (objects.length === 0) return null
  const boxes = objects.map(inkBounds)
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
