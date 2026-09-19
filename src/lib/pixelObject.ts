import { createId } from './id'
import type { PixelObject, StitchColor } from './types'

export function createEmptyPixelObject(): PixelObject {
  return { id: createId(), kind: 'pixels', x: 0, y: 0, cells: [] }
}

// Paints (or repaints) a single absolute grid cell. The object's x/y and every
// cell's dx/dy get rebased so x/y is always the drawing's true top-left corner
// and every dx/dy is >= 0 — the same invariant text/icon objects have "for free"
// by construction. Without this, drawing to the left of or above the first
// painted cell would produce negative offsets that break clampToCanvas/align,
// which assume x/y is the left/top edge.
export function paintCell(obj: PixelObject, gx: number, gy: number, color: StitchColor): PixelObject {
  const absoluteCells = obj.cells.map((c) => ({ gx: obj.x + c.dx, gy: obj.y + c.dy, color: c.color }))
  const existingIndex = absoluteCells.findIndex((c) => c.gx === gx && c.gy === gy)
  if (existingIndex >= 0) {
    absoluteCells[existingIndex] = { gx, gy, color }
  } else {
    absoluteCells.push({ gx, gy, color })
  }
  return rebase(obj.id, absoluteCells)
}

export function eraseCell(obj: PixelObject, gx: number, gy: number): PixelObject {
  const absoluteCells = obj.cells
    .map((c) => ({ gx: obj.x + c.dx, gy: obj.y + c.dy, color: c.color }))
    .filter((c) => !(c.gx === gx && c.gy === gy))
  return rebase(obj.id, absoluteCells)
}

function rebase(id: string, absoluteCells: { gx: number; gy: number; color: StitchColor }[]): PixelObject {
  if (absoluteCells.length === 0) {
    return { id, kind: 'pixels', x: 0, y: 0, cells: [] }
  }
  const minGx = Math.min(...absoluteCells.map((c) => c.gx))
  const minGy = Math.min(...absoluteCells.map((c) => c.gy))
  return {
    id,
    kind: 'pixels',
    x: minGx,
    y: minGy,
    cells: absoluteCells.map((c) => ({ dx: c.gx - minGx, dy: c.gy - minGy, color: c.color })),
  }
}
