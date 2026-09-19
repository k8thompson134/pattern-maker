import type { CanvasObject } from './types'
import { getFont } from './fonts'
import { measureText } from './textRender'
import { getIcon } from './icons'
import { measureIcon } from './iconRender'

// Scale must stay a whole integer — each glyph/icon pixel becomes an NxN block of
// stitches, and a fractional scale would put half-stitches on the grid, which isn't
// a real thing in cross-stitch. So "finer control" means more integer steps, not
// fractional ones. 6 gives noticeably smoother-feeling growth than the original 3
// (see CLAUDE.md's "Known issues" section for the mobile corner-drag context).
export const MAX_OBJECT_SCALE = 6

export function measureObject(obj: CanvasObject): { width: number; height: number } {
  if (obj.kind === 'text') {
    return measureText(obj.content, getFont(obj.font), obj.direction, obj.scale)
  }
  if (obj.kind === 'icon') {
    return measureIcon(getIcon(obj.iconId), obj.scale)
  }
  if (obj.cells.length === 0) return { width: 0, height: 0 }
  const maxDx = Math.max(...obj.cells.map((c) => c.dx))
  const maxDy = Math.max(...obj.cells.map((c) => c.dy))
  return { width: maxDx + 1, height: maxDy + 1 }
}

export function clampToCanvas<T extends CanvasObject>(
  obj: T,
  canvasWidth: number,
  canvasHeight: number,
): T {
  const { width, height } = measureObject(obj)
  const maxX = Math.max(0, canvasWidth - width)
  const maxY = Math.max(0, canvasHeight - height)
  return { ...obj, x: Math.min(Math.max(0, obj.x), maxX), y: Math.min(Math.max(0, obj.y), maxY) }
}
