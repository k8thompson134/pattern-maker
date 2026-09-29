import type { Bounds } from './selection'

export const SNAP_THRESHOLD = 2

export type SnapResult = { dx: number; dy: number; guidesX: number[]; guidesY: number[] }

// Positions along one axis that a dragged box can line up with: its start, middle and end.
function offsets(size: number): number[] {
  return [0, size / 2, size]
}

function snapAxis(start: number, size: number, targets: number[], delta: number, min: number, max: number): number {
  let best = delta
  let bestDist = SNAP_THRESHOLD + 1
  for (const t of targets) {
    for (const o of offsets(size)) {
      const shift = Math.floor(t - o) - (start + delta)
      if (Math.abs(shift) < bestDist) {
        bestDist = Math.abs(shift)
        best = delta + shift
      }
    }
  }
  return bestDist <= SNAP_THRESHOLD ? Math.min(Math.max(min, best), max) : delta
}

function guidesAt(start: number, size: number, targets: number[]): number[] {
  const found = new Set<number>()
  for (const t of targets) {
    for (const o of offsets(size)) {
      if (start + o === t) found.add(t)
    }
  }
  return [...found]
}

export function guideTargets(canvasSize: number, others: Bounds[], axis: 'x' | 'y'): number[] {
  const targets = [0, canvasSize / 2, canvasSize]
  for (const b of others) {
    const start = axis === 'x' ? b.x : b.y
    const size = axis === 'x' ? b.width : b.height
    targets.push(...offsets(size).map((o) => start + o))
  }
  return targets
}

// `moving` is the ink box of what is being dragged at drag start; `dx`/`dy` the raw
// (whole-stitch) drag distance. Snapping pulls the box's edge or middle onto a nearby
// guide, then re-clamps so the declared box still stays on the canvas.
export function snapMove(
  moving: Bounds,
  targetsX: number[],
  targetsY: number[],
  dx: number,
  dy: number,
  limits: { minDx: number; maxDx: number; minDy: number; maxDy: number },
  enabled: boolean,
): SnapResult {
  const sx = enabled ? snapAxis(moving.x, moving.width, targetsX, dx, limits.minDx, limits.maxDx) : dx
  const sy = enabled ? snapAxis(moving.y, moving.height, targetsY, dy, limits.minDy, limits.maxDy) : dy
  return {
    dx: sx,
    dy: sy,
    guidesX: enabled ? guidesAt(moving.x + sx, moving.width, targetsX) : [],
    guidesY: enabled ? guidesAt(moving.y + sy, moving.height, targetsY) : [],
  }
}
