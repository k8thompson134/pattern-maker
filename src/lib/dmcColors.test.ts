import { describe, expect, it } from 'vitest'
import { DMC_STARTER_COLORS, searchDmcColors } from './dmcColors'
import { DMC_PALETTE } from './dmcPalette'

describe('DMC palette', () => {
  it('has unique codes and valid hex values', () => {
    expect(new Set(DMC_PALETTE.map((c) => c.dmcCode)).size).toBe(DMC_PALETTE.length)
    for (const c of DMC_PALETTE) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('draws the starter swatches from the full palette', () => {
    expect(DMC_STARTER_COLORS).toHaveLength(14)
    for (const c of DMC_STARTER_COLORS) expect(DMC_PALETTE).toContain(c)
  })
})

describe('searchDmcColors', () => {
  it('returns everything for a blank query', () => {
    expect(searchDmcColors('  ')).toHaveLength(DMC_PALETTE.length)
  })

  it('matches by code prefix and by name substring, case-insensitively', () => {
    expect(searchDmcColors('798').some((c) => c.dmcCode === '798')).toBe(true)
    const blues = searchDmcColors('DELFT')
    expect(blues.length).toBeGreaterThan(0)
    expect(blues.every((c) => c.name.toLowerCase().includes('delft'))).toBe(true)
  })

  it('returns nothing for a query that matches no color', () => {
    expect(searchDmcColors('zzzz')).toEqual([])
  })
})
