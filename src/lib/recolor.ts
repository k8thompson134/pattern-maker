import type { CanvasObject, StitchColor } from './types'

// Swaps every use of one DMC color for another, across text, icons, and per-cell drawings.
// Untouched objects keep their identity.
export function replaceColor(objects: CanvasObject[], fromCode: string, to: StitchColor): CanvasObject[] {
  return objects.map((o) => {
    if (o.kind === 'pixels') {
      if (!o.cells.some((c) => c.color.dmcCode === fromCode)) return o
      return { ...o, cells: o.cells.map((c) => (c.color.dmcCode === fromCode ? { ...c, color: to } : c)) }
    }
    return o.color.dmcCode === fromCode ? { ...o, color: to } : o
  })
}
