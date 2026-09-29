import { createId } from './id'
import type { PixelObject, StitchColor } from './types'

export type GridCell = { gx: number; gy: number }

export function createEmptyPixelObject(): PixelObject {
  return { id: createId(), kind: 'pixels', x: 0, y: 0, cells: [] }
}

// Paints (or repaints) absolute grid cells. The object's x/y and every cell's
// dx/dy get rebased so x/y is always the drawing's true top-left corner and every
// dx/dy is >= 0 — the same invariant text/icon objects have "for free" by
// construction. Without this, drawing to the left of or above the first painted
// cell would produce negative offsets that break clampToCanvas/align, which
// assume x/y is the left/top edge.
export function paintCells(obj: PixelObject, cells: GridCell[], color: StitchColor): PixelObject {
  const absolute = new Map<string, { gx: number; gy: number; color: StitchColor }>()
  for (const c of obj.cells) absolute.set(`${obj.x + c.dx},${obj.y + c.dy}`, { gx: obj.x + c.dx, gy: obj.y + c.dy, color: c.color })
  for (const { gx, gy } of cells) absolute.set(`${gx},${gy}`, { gx, gy, color })
  return rebase(obj, [...absolute.values()])
}

export function eraseCells(obj: PixelObject, cells: GridCell[]): PixelObject {
  const erased = new Set(cells.map(({ gx, gy }) => `${gx},${gy}`))
  const remaining = obj.cells
    .map((c) => ({ gx: obj.x + c.dx, gy: obj.y + c.dy, color: c.color }))
    .filter((c) => !erased.has(`${c.gx},${c.gy}`))
  return rebase(obj, remaining)
}

export function paintCell(obj: PixelObject, gx: number, gy: number, color: StitchColor): PixelObject {
  return paintCells(obj, [{ gx, gy }], color)
}

export function eraseCell(obj: PixelObject, gx: number, gy: number): PixelObject {
  return eraseCells(obj, [{ gx, gy }])
}

// Every cell on the straight line between two cells, both ends included, so a fast
// drag that skips grid cells between pointer events still paints a continuous stroke.
export function lineCells(from: GridCell, to: GridCell): GridCell[] {
  const cells: GridCell[] = []
  const dx = Math.abs(to.gx - from.gx)
  const dy = Math.abs(to.gy - from.gy)
  const stepX = from.gx < to.gx ? 1 : -1
  const stepY = from.gy < to.gy ? 1 : -1
  let err = dx - dy
  let gx = from.gx
  let gy = from.gy
  for (;;) {
    cells.push({ gx, gy })
    if (gx === to.gx && gy === to.gy) return cells
    const doubled = err * 2
    if (doubled > -dy) {
      err -= dy
      gx += stepX
    }
    if (doubled < dx) {
      err += dx
      gy += stepY
    }
  }
}

function rebase(obj: PixelObject, absoluteCells: { gx: number; gy: number; color: StitchColor }[]): PixelObject {
  if (absoluteCells.length === 0) {
    return { ...obj, x: 0, y: 0, cells: [] }
  }
  const minGx = Math.min(...absoluteCells.map((c) => c.gx))
  const minGy = Math.min(...absoluteCells.map((c) => c.gy))
  return {
    ...obj,
    x: minGx,
    y: minGy,
    cells: absoluteCells.map((c) => ({ dx: c.gx - minGx, dy: c.gy - minGy, color: c.color })),
  }
}
