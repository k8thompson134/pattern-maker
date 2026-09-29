import type { CanvasObject, IconObject, StitchColor, TextObject } from './types'
import type { FilledCell } from './textRender'
import { getIcon, type IconDef } from './icons'
import { DMC_PALETTE } from './dmcPalette'

const DEFAULT_ACCENT_CODE = '310'

export function byCode(code: string): StitchColor {
  const found = DMC_PALETTE.find((c) => c.dmcCode === code)
  if (!found) throw new Error(`DMC ${code} missing from palette`)
  return found
}

export function iconHasAccent(icon: IconDef): boolean {
  return icon.rows.some((r) => r.includes('2'))
}

export function accentColorOf(obj: IconObject): StitchColor {
  return obj.color2 ?? byCode(getIcon(obj.iconId).accent ?? DEFAULT_ACCENT_CODE)
}

// The color for one rendered cell: accent cells use the second color, everything else the main color.
export function cellColor(obj: TextObject | IconObject, cell: FilledCell): StitchColor {
  if (obj.kind === 'icon' && cell.accent) return accentColorOf(obj)
  return obj.color
}

// Every color an object stitches with — the main color, plus the accent for two-tone icons.
export function objectColors(obj: CanvasObject): StitchColor[] {
  if (obj.kind === 'pixels') return obj.cells.map((c) => c.color)
  if (obj.kind === 'icon' && iconHasAccent(getIcon(obj.iconId))) return [obj.color, accentColorOf(obj)]
  return [obj.color]
}

// Colors to start a freshly placed icon with: the icon's own defaults if it has them, else the picked color.
export function newIconColors(icon: IconDef, picked: StitchColor): Pick<IconObject, 'color' | 'color2'> {
  return {
    color: icon.main ? byCode(icon.main) : picked,
    ...(iconHasAccent(icon) ? { color2: byCode(icon.accent ?? DEFAULT_ACCENT_CODE) } : {}),
  }
}

// Hex colors for picker thumbnails: the icon's real default stitches, or dark ink for icons that take whatever color is picked.
export function iconPreviewColors(icon: IconDef): { color: string; accent: string } {
  return {
    color: icon.main ? byCode(icon.main).hex : '#333',
    accent: byCode(icon.accent ?? DEFAULT_ACCENT_CODE).hex,
  }
}
