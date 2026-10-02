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

// Generates the footprint of cells for a brush of size N centered at a grid cell.
// An NxN square around the cell; even sizes extend one extra stitch up and left.
export function brushOffsets(size: number): { ox: number; oy: number }[] {
  const s = Math.max(1, Math.min(6, Math.floor(size)))
  if (s === 1) return [{ ox: 0, oy: 0 }]
  const offsets: { ox: number; oy: number }[] = []
  const half = Math.floor(s / 2)
  for (let dy = 0; dy < s; dy++) {
    for (let dx = 0; dx < s; dx++) {
      offsets.push({ ox: dx - half, oy: dy - half })
    }
  }
  return offsets
}

// Expands a list of center cells by the brush size footprint, deduplicating cells
export function expandByBrush(cells: GridCell[], brushSize: number): GridCell[] {
  if (brushSize <= 1) return cells
  const offsets = brushOffsets(brushSize)
  const seen = new Set<string>()
  const result: GridCell[] = []
  for (const { gx, gy } of cells) {
    for (const { ox, oy } of offsets) {
      const key = `${gx + ox},${gy + oy}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ gx: gx + ox, gy: gy + oy })
      }
    }
  }
  return result
}

// Computes a straight line between two cells with optional 45°/90° snapping (horizontal, vertical, or diagonal).
export function straightLineCells(from: GridCell, to: GridCell, snapStraight = false): GridCell[] {
  if (!snapStraight) {
    return lineCells(from, to)
  }
  const dx = to.gx - from.gx
  const dy = to.gy - from.gy
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let endX = to.gx
  let endY = to.gy

  // Snap to horizontal, vertical, or perfect diagonal (whichever is closest)
  if (absDx > 2 * absDy) {
    // Mostly horizontal
    endY = from.gy
  } else if (absDy > 2 * absDx) {
    // Mostly vertical
    endX = from.gx
  } else {
    // Diagonal: make dx and dy equal in magnitude
    const dist = Math.round((absDx + absDy) / 2)
    endX = from.gx + (dx >= 0 ? dist : -dist)
    endY = from.gy + (dy >= 0 ? dist : -dist)
  }

  return lineCells(from, { gx: endX, gy: endY })
}

// Computes all cells inside a filled bounding box between two corners (inclusive).
export function rectangleCells(from: GridCell, to: GridCell): GridCell[] {
  const minX = Math.min(from.gx, to.gx)
  const maxX = Math.max(from.gx, to.gx)
  const minY = Math.min(from.gy, to.gy)
  const maxY = Math.max(from.gy, to.gy)

  const cells: GridCell[] = []
  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      cells.push({ gx, gy })
    }
  }
  return cells
}

// Computes the 4-connected flood fill starting from seed cell within the canvas.
// `targetColorKey`: the color key ('empty' or dmcCode) of the area being filled.
// `colorAt`: callback to inspect what exists at any cell.
// Stops at boundaries where colorAt(x, y) !== targetColorKey.
export function floodFillCells(
  seed: GridCell,
  width: number,
  height: number,
  colorAt: (gx: number, gy: number) => string | null,
): GridCell[] {
  if (seed.gx < 0 || seed.gy < 0 || seed.gx >= width || seed.gy >= height) return []

  const target = colorAt(seed.gx, seed.gy)
  const filled: GridCell[] = []
  const visited = new Set<string>()
  const queue: GridCell[] = [seed]
  visited.add(`${seed.gx},${seed.gy}`)

  // 4-way cardinal directions
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!
    filled.push(cur)

    for (const { dx, dy } of dirs) {
      const nx = cur.gx + dx
      const ny = cur.gy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const key = `${nx},${ny}`
      if (visited.has(key)) continue
      visited.add(key)

      if (colorAt(nx, ny) === target) {
        queue.push({ gx: nx, gy: ny })
      }
    }
  }

  return filled
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
