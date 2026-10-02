import type { CanvasObject } from './types'
import { measureObject } from './objectMeasure'
import { renderObjectCells } from './objectCells'
import { createId } from './id'

export type Bounds = { x: number; y: number; width: number; height: number }

// Selecting any member of a group selects the whole group.
export function expandToGroups(ids: string[], objects: CanvasObject[]): string[] {
  const groupIds = new Set(objects.filter((o) => ids.includes(o.id) && o.groupId).map((o) => o.groupId))
  return objects.filter((o) => ids.includes(o.id) || (o.groupId && groupIds.has(o.groupId))).map((o) => o.id)
}

export function selectionBounds(objects: CanvasObject[]): Bounds | null {
  if (objects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const o of objects) {
    const { width, height } = measureObject(o)
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + width)
    maxY = Math.max(maxY, o.y + height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// Clamps one shared delta against the union box. Clamping each member separately
// would pin some against an edge while others keep moving, deforming the arrangement.
export function clampSelectionDelta(
  bounds: Bounds,
  dx: number,
  dy: number,
  canvasWidth: number,
  canvasHeight: number,
): { dx: number; dy: number } {
  const maxX = Math.max(0, canvasWidth - bounds.width)
  const maxY = Math.max(0, canvasHeight - bounds.height)
  return {
    dx: Math.min(Math.max(0, bounds.x + dx), maxX) - bounds.x,
    dy: Math.min(Math.max(0, bounds.y + dy), maxY) - bounds.y,
  }
}

// Copies get fresh ids, and each source group maps to one fresh group id so copies
// form their own group instead of silently joining the original's.
export function cloneSelection(objects: CanvasObject[], dx: number, dy: number): CanvasObject[] {
  const groupMap = new Map<string, string>()
  return objects.map((o) => {
    let groupId: string | undefined
    if (o.groupId) {
      if (!groupMap.has(o.groupId)) groupMap.set(o.groupId, createId())
      groupId = groupMap.get(o.groupId)
    }
    return { ...o, id: createId(), groupId, x: o.x + dx, y: o.y + dy }
  })
}

// Additive (shift-click or Select-multiple mode) toggles the clicked object's group
// in/out. Non-additive keeps the current selection when clicking an already-selected
// object — otherwise a multi-selection could never be dragged.
export function nextSelection(current: string[], clickedId: string, additive: boolean, objects: CanvasObject[]): string[] {
  const group = expandToGroups([clickedId], objects)
  const alreadySelected = current.includes(clickedId)
  if (additive) {
    return alreadySelected ? current.filter((id) => !group.includes(id)) : [...current, ...group.filter((id) => !current.includes(id))]
  }
  return alreadySelected ? current : group
}

// Objects (expanded to groups) with at least one stitch inside the box. Tested per stitch,
// not by declared box, so a canvas-sized border doesn't join every marquee.
export function objectsIntersectingBox(box: Bounds, objects: CanvasObject[]): string[] {
  const boxRight = box.x + box.width
  const boxBottom = box.y + box.height

  const hitIds = objects
    .filter((obj) => {
      const cells = obj.kind === 'pixels' ? obj.cells : renderObjectCells(obj)
      return cells.some((c) => {
        const x = obj.x + c.dx
        const y = obj.y + c.dy
        return x >= box.x && x < boxRight && y >= box.y && y < boxBottom
      })
    })
    .map((obj) => obj.id)

  return expandToGroups(hitIds, objects)
}
