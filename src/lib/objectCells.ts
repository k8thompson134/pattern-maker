import type { IconObject, TextObject } from './types'
import { getFont } from './fonts'
import { measureText, renderTextToCells, type FilledCell } from './textRender'
import { getIcon } from './icons'
import { measureIcon, renderIconToCells } from './iconRender'

// Rotates cells clockwise within a width x height box (90° steps), rebased so every
// dx/dy stays >= 0 — rotation is baked into the stitches themselves, so the screen,
// PDF export, measuring, and clamping all see the same rotated shape.
export function rotateCells(cells: FilledCell[], width: number, height: number, rotation: number): FilledCell[] {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return cells.map((c) => ({ ...c, dx: height - 1 - c.dy, dy: c.dx }))
    case 180:
      return cells.map((c) => ({ ...c, dx: width - 1 - c.dx, dy: height - 1 - c.dy }))
    case 270:
      return cells.map((c) => ({ ...c, dx: c.dy, dy: width - 1 - c.dx }))
    default:
      return cells
  }
}

export function renderObjectCells(obj: TextObject | IconObject): FilledCell[] {
  if (obj.kind === 'text') {
    const font = getFont(obj.font)
    const { width, height } = measureText(obj.content, font, obj.direction, obj.scale)
    return rotateCells(renderTextToCells(obj.content, font, obj.direction, obj.scale), width, height, obj.rotation)
  }
  const icon = getIcon(obj.iconId)
  const { width, height } = measureIcon(icon, obj.scale)
  return rotateCells(renderIconToCells(icon, obj.scale), width, height, obj.rotation)
}
