import type { StitchColor } from './types'
import { DMC_PALETTE } from './dmcPalette'

const STARTER_CODES = ['310', 'B5200', '321', '666', '703', '798', '809', '972', '3607', '552', '992', '3799', '415', '976']

// The quick-pick swatches shown by default; the full palette is behind "More colors".
export const DMC_STARTER_COLORS: StitchColor[] = STARTER_CODES.map((code) => {
  const c = DMC_PALETTE.find((p) => p.dmcCode === code)
  if (!c) throw new Error(`Starter color DMC ${code} missing from palette`)
  return c
})

// Case-insensitive match on code (prefix) or any part of the name; blank query returns everything.
export function searchDmcColors(query: string): StitchColor[] {
  const q = query.trim().toLowerCase()
  if (!q) return DMC_PALETTE
  return DMC_PALETTE.filter((c) => c.dmcCode.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q))
}
