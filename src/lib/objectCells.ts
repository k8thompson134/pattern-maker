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

export function flipCells(cells: FilledCell[], width: number, height: number, horizontal: boolean, vertical: boolean): FilledCell[] {
  if (!horizontal && !vertical) return cells
  return cells.map((c) => ({ ...c, dx: horizontal ? width - 1 - c.dx : c.dx, dy: vertical ? height - 1 - c.dy : c.dy }))
}

// Mirroring is applied after rotation, so on a singly-mirrored object the stored angle
// turns the opposite way on screen. The rotation buttons talk in on-screen angles; this
// maps between them and the stored value (it is its own inverse).
export function displayRotation(rotation: number, mirrorH?: boolean, mirrorV?: boolean): number {
  return !!mirrorH !== !!mirrorV ? (360 - rotation) % 360 : rotation
}

export function renderObjectCells(obj: TextObject | IconObject): FilledCell[] {
  let size: { width: number; height: number }
  let cells: FilledCell[]
  if (obj.kind === 'text') {
    const font = getFont(obj.font)
    size = measureText(obj.content, font, obj.direction, obj.scale)
    cells = renderTextToCells(obj.content, font, obj.direction, obj.scale)
  } else {
    const icon = getIcon(obj.iconId)
    size = measureIcon(icon, obj.scale)
    cells = renderIconToCells(icon, obj.scale)
  }
  const rotated = rotateCells(cells, size.width, size.height, obj.rotation)
  const quarter = obj.rotation % 180 !== 0
  const width = quarter ? size.height : size.width
  const height = quarter ? size.width : size.height
  return flipCells(rotated, width, height, !!obj.mirrorH, !!obj.mirrorV)
}
