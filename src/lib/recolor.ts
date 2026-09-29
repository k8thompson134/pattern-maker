import type { CanvasObject, StitchColor } from './types'
import { accentColorOf, iconHasAccent } from './iconColors'
import { getIcon } from './icons'

// Swaps every use of one DMC color for another, across text, icons (main and accent), and per-cell drawings.
// Untouched objects keep their identity.
export function replaceColor(objects: CanvasObject[], fromCode: string, to: StitchColor): CanvasObject[] {
  return objects.map((o) => {
    if (o.kind === 'pixels') {
      if (!o.cells.some((c) => c.color.dmcCode === fromCode)) return o
      return { ...o, cells: o.cells.map((c) => (c.color.dmcCode === fromCode ? { ...c, color: to } : c)) }
    }
    const mainHit = o.color.dmcCode === fromCode
    const accentHit = o.kind === 'icon' && iconHasAccent(getIcon(o.iconId)) && accentColorOf(o).dmcCode === fromCode
    if (!mainHit && !accentHit) return o
    return { ...o, ...(mainHit ? { color: to } : {}), ...(accentHit ? { color2: to } : {}) }
  })
}
