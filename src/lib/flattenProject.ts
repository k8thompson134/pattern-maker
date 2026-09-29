import type { Project, StitchColor } from './types'
import { renderObjectCells } from './objectCells'
import { cellColor } from './iconColors'

export type FlattenedCell = { x: number; y: number; color: StitchColor }

// Collapses every object into a single grid of absolute-position stitches, exactly
// as they're drawn on screen — later objects in the array paint over earlier ones
// at the same cell, matching the same z-order CanvasGrid renders in. This is the
// shared source of truth for anything that needs "what does the finished pattern
// actually look like" (PDF export today; anything else that needs a flat render
// later shouldn't reimplement this).
export function flattenProject(project: Project): FlattenedCell[] {
  const grid = new Map<string, FlattenedCell>()

  for (const obj of project.objects) {
    if (obj.kind === 'pixels') {
      for (const c of obj.cells) {
        const x = obj.x + c.dx
        const y = obj.y + c.dy
        grid.set(`${x},${y}`, { x, y, color: c.color })
      }
      continue
    }

    for (const c of renderObjectCells(obj)) {
      const x = obj.x + c.dx
      const y = obj.y + c.dy
      grid.set(`${x},${y}`, { x, y, color: cellColor(obj, c) })
    }
  }

  return [...grid.values()]
}

export type ColorUsage = { color: StitchColor; count: number }

export function summarizeColors(cells: FlattenedCell[]): ColorUsage[] {
  const counts = new Map<string, ColorUsage>()
  for (const c of cells) {
    const existing = counts.get(c.color.dmcCode)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(c.color.dmcCode, { color: c.color, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
