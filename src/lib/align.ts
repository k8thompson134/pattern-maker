import type { CanvasObject } from './types'
import { clampToCanvas, measureObject } from './objectMeasure'
import { clampSelectionDelta, selectionBounds, type Bounds } from './selection'

export type Alignment = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'

export function alignObject<T extends CanvasObject>(
  obj: T,
  canvasWidth: number,
  canvasHeight: number,
  alignment: Alignment,
): T {
  const { width, height } = measureObject(obj)
  let next: T = obj

  switch (alignment) {
    case 'left':
      next = { ...obj, x: 0 }
      break
    case 'center-h':
      next = { ...obj, x: Math.floor((canvasWidth - width) / 2) }
      break
    case 'right':
      next = { ...obj, x: canvasWidth - width }
      break
    case 'top':
      next = { ...obj, y: 0 }
      break
    case 'center-v':
      next = { ...obj, y: Math.floor((canvasHeight - height) / 2) }
      break
    case 'bottom':
      next = { ...obj, y: canvasHeight - height }
      break
  }

  return clampToCanvas(next, canvasWidth, canvasHeight)
}

export type DistributeAxis = 'horizontal' | 'vertical'

type Unit = { members: CanvasObject[]; bounds: Bounds }

// A group moves as one unit — aligning or spacing its members individually would
// break up the arrangement — so each groupId is one unit and every ungrouped object
// is its own.
function toUnits(objects: CanvasObject[]): Unit[] {
  const byGroup = new Map<string, CanvasObject[]>()
  const units: CanvasObject[][] = []
  for (const o of objects) {
    if (!o.groupId) {
      units.push([o])
      continue
    }
    const members = byGroup.get(o.groupId)
    if (members) members.push(o)
    else {
      const created = [o]
      byGroup.set(o.groupId, created)
      units.push(created)
    }
  }
  return units.map((members) => ({ members, bounds: selectionBounds(members)! }))
}

function shifted(objects: CanvasObject[], deltas: Map<CanvasObject, { dx: number; dy: number }>): CanvasObject[] {
  return objects.map((o) => {
    const d = deltas.get(o)
    return d ? { ...o, x: o.x + d.dx, y: o.y + d.dy } : o
  })
}

export function countUnits(objects: CanvasObject[]): number {
  return toUnits(objects).length
}

// Moves every unit so its edge/center matches the reference box (the selection's
// bounds, or the canvas). Returns the objects in the same order.
export function alignUnits(
  objects: CanvasObject[],
  alignment: Alignment,
  reference: Bounds,
  canvasWidth: number,
  canvasHeight: number,
): CanvasObject[] {
  const deltas = new Map<CanvasObject, { dx: number; dy: number }>()
  for (const { members, bounds: b } of toUnits(objects)) {
    let dx = 0
    let dy = 0
    switch (alignment) {
      case 'left':
        dx = reference.x - b.x
        break
      case 'center-h':
        dx = reference.x + Math.floor((reference.width - b.width) / 2) - b.x
        break
      case 'right':
        dx = reference.x + reference.width - b.width - b.x
        break
      case 'top':
        dy = reference.y - b.y
        break
      case 'center-v':
        dy = reference.y + Math.floor((reference.height - b.height) / 2) - b.y
        break
      case 'bottom':
        dy = reference.y + reference.height - b.height - b.y
        break
    }
    const clamped = clampSelectionDelta(b, dx, dy, canvasWidth, canvasHeight)
    for (const m of members) deltas.set(m, clamped)
  }
  return shifted(objects, deltas)
}

// Keeps the first and last unit (by position along the axis) where they are and
// spaces the ones between so every gap is equal; a remainder of stitches goes one
// each to the leading gaps. Needs three or more units — fewer returns the input.
export function distributeUnits(objects: CanvasObject[], axis: DistributeAxis): CanvasObject[] {
  const units = toUnits(objects)
  if (units.length < 3) return objects

  const start = (u: Unit) => (axis === 'horizontal' ? u.bounds.x : u.bounds.y)
  const size = (u: Unit) => (axis === 'horizontal' ? u.bounds.width : u.bounds.height)
  const ordered = [...units].sort((a, b) => start(a) - start(b))

  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const free = start(last) + size(last) - start(first) - ordered.reduce((sum, u) => sum + size(u), 0)
  const gaps = ordered.length - 1
  const base = Math.floor(free / gaps)
  const extra = free - base * gaps

  const deltas = new Map<CanvasObject, { dx: number; dy: number }>()
  let cursor = start(first)
  ordered.forEach((u, i) => {
    const move = cursor - start(u)
    for (const m of u.members) deltas.set(m, axis === 'horizontal' ? { dx: move, dy: 0 } : { dx: 0, dy: move })
    cursor += size(u) + base + (i < extra ? 1 : 0)
  })
  return shifted(objects, deltas)
}
