import { describe, expect, it } from 'vitest'
import { accentDroppedChars, measureText, renderTextToCells, unsupportedChars } from './textRender'
import { AVAILABLE_FONTS, FONT_BLOCK_5X7, FONT_ITALIC_5X9, FONT_MIXED_5X9 } from './fonts'

describe('renderTextToCells', () => {
  it('renders a single glyph at scale 1 with no cells outside the 5x7 box', () => {
    const cells = renderTextToCells('I', FONT_BLOCK_5X7, 'horizontal', 1)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      expect(c.dx).toBeGreaterThanOrEqual(0)
      expect(c.dx).toBeLessThan(5)
      expect(c.dy).toBeGreaterThanOrEqual(0)
      expect(c.dy).toBeLessThan(7)
    }
  })

  it('advances horizontally so each letter occupies its own column band', () => {
    const cells = renderTextToCells('HI', FONT_BLOCK_5X7, 'horizontal', 1)
    const hCells = cells.filter((c) => c.dx < 5)
    const iCells = cells.filter((c) => c.dx >= 6)
    expect(hCells.length).toBeGreaterThan(0)
    expect(iCells.length).toBeGreaterThan(0)
    // no cells should land in the 1-stitch letter-spacing gap
    expect(cells.some((c) => c.dx === 5)).toBe(false)
  })

  it('stacks letters downward instead of across in vertical direction', () => {
    const cells = renderTextToCells('HI', FONT_BLOCK_5X7, 'vertical', 1)
    const hCells = cells.filter((c) => c.dy < 7)
    const iCells = cells.filter((c) => c.dy >= 8)
    expect(hCells.length).toBeGreaterThan(0)
    expect(iCells.length).toBeGreaterThan(0)
    // vertical text should stay within the glyph's own width, never spreading sideways
    for (const c of cells) {
      expect(c.dx).toBeLessThan(5)
    }
  })

  it('multiplies each glyph pixel into an NxN block at higher scale', () => {
    const at1x = renderTextToCells('I', FONT_BLOCK_5X7, 'horizontal', 1)
    const at2x = renderTextToCells('I', FONT_BLOCK_5X7, 'horizontal', 2)
    expect(at2x.length).toBe(at1x.length * 4)
  })

  it('falls back to the space glyph for unsupported characters', () => {
    const cells = renderTextToCells('~', FONT_BLOCK_5X7, 'horizontal', 1)
    expect(cells).toEqual([])
  })

  it('is case-insensitive, mapping lowercase to the same glyph as uppercase', () => {
    const lower = renderTextToCells('a', FONT_BLOCK_5X7, 'horizontal', 1)
    const upper = renderTextToCells('A', FONT_BLOCK_5X7, 'horizontal', 1)
    expect(lower).toEqual(upper)
  })
})

describe('measureText', () => {
  it('returns zero size for empty text', () => {
    expect(measureText('', FONT_BLOCK_5X7)).toEqual({ width: 0, height: 0 })
  })

  it('grows width (not height) for longer horizontal text', () => {
    const short = measureText('HI', FONT_BLOCK_5X7, 'horizontal', 1)
    const long = measureText('HELLO', FONT_BLOCK_5X7, 'horizontal', 1)
    expect(long.width).toBeGreaterThan(short.width)
    expect(long.height).toBe(short.height)
  })

  it('grows height (not width) for longer vertical text', () => {
    const short = measureText('HI', FONT_BLOCK_5X7, 'vertical', 1)
    const long = measureText('HELLO', FONT_BLOCK_5X7, 'vertical', 1)
    expect(long.height).toBeGreaterThan(short.height)
    expect(long.width).toBe(short.width)
  })

  it('scales both dimensions proportionally', () => {
    const at1x = measureText('HI', FONT_BLOCK_5X7, 'horizontal', 1)
    const at2x = measureText('HI', FONT_BLOCK_5X7, 'horizontal', 2)
    expect(at2x.width).toBe(at1x.width * 2)
    expect(at2x.height).toBe(at1x.height * 2)
  })
})

describe('unsupportedChars', () => {
  it('returns nothing for a fully-supported phrase', () => {
    expect(unsupportedChars('Hello, World! 123', FONT_BLOCK_5X7)).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(unsupportedChars('hello', FONT_BLOCK_5X7)).toEqual([])
  })

  it('flags characters with no glyph, deduplicated', () => {
    expect(unsupportedChars('J ~ J ~ ¤', FONT_BLOCK_5X7).sort()).toEqual(['~', '¤'].sort())
  })

  it('supports the common punctuation for dates and couples', () => {
    expect(unsupportedChars('Sam & Alex 9/25: #1 (2026)', FONT_BLOCK_5X7)).toEqual([])
  })

  it('treats accented letters as supported via their base letter', () => {
    expect(unsupportedChars('José Zoë', FONT_BLOCK_5X7)).toEqual([])
  })
})

describe('accentDroppedChars', () => {
  it('lists accents a caps-only font draws plain, but not ones the font has', () => {
    expect(accentDroppedChars('José', FONT_BLOCK_5X7)).toEqual(['é'])
    expect(accentDroppedChars('José', FONT_MIXED_5X9)).toEqual([])
  })
})

describe('font data', () => {
  it.each(AVAILABLE_FONTS.map((f) => [f.id, f] as const))('%s has rectangular glyphs of the declared height', (_id, font) => {
    for (const [ch, rows] of Object.entries(font.glyphs)) {
      expect(rows.length, `height of ${ch}`).toBe(font.cellHeight)
      for (const row of rows) {
        expect(row.length, `width of ${ch}`).toBe(rows[0].length)
        expect(row).toMatch(/^[01]+$/)
      }
      expect(rows[0].length, `width of ${ch}`).toBeLessThanOrEqual(font.cellWidth)
    }
  })
})

describe('mixed-case font', () => {
  it('draws lowercase differently from uppercase', () => {
    expect(renderTextToCells('a', FONT_MIXED_5X9)).not.toEqual(renderTextToCells('A', FONT_MIXED_5X9))
  })

  it('gives narrow letters less room than wide ones', () => {
    expect(measureText('ii', FONT_MIXED_5X9).width).toBeLessThan(measureText('mm', FONT_MIXED_5X9).width)
  })

  it('drops descenders below the baseline', () => {
    const cells = renderTextToCells('g', FONT_MIXED_5X9)
    expect(Math.max(...cells.map((c) => c.dy))).toBe(8)
    expect(Math.max(...renderTextToCells('a', FONT_MIXED_5X9).map((c) => c.dy))).toBe(6)
  })

  it('draws accents above the letter and treats decomposed input the same', () => {
    const plain = renderTextToCells('e', FONT_MIXED_5X9)
    const accented = renderTextToCells('é', FONT_MIXED_5X9)
    expect(accented.length).toBeGreaterThan(plain.length)
    expect(accented.filter((c) => c.dy < 2).length).toBeGreaterThan(0)
    expect(renderTextToCells('e\u0301', FONT_MIXED_5X9)).toEqual(accented)
  })

  it('draws a cedilla below the letter', () => {
    expect(Math.max(...renderTextToCells('ç', FONT_MIXED_5X9).map((c) => c.dy))).toBe(8)
  })

  it('measures exactly what it renders', () => {
    const text = 'Wiggly jig'
    const cells = renderTextToCells(text, FONT_MIXED_5X9)
    const { width } = measureText(text, FONT_MIXED_5X9)
    expect(Math.max(...cells.map((c) => c.dx))).toBeLessThan(width)
  })
})

describe('italic font', () => {
  it('shifts upper rows right of the bottom rows of the same letter', () => {
    const upright = renderTextToCells('l', FONT_MIXED_5X9)
    const slanted = renderTextToCells('l', FONT_ITALIC_5X9)
    const minX = (cells: { dx: number; dy: number }[], row: number) => Math.min(...cells.filter((c) => c.dy === row).map((c) => c.dx))
    expect(minX(slanted, 0) - minX(slanted, 6)).toBeGreaterThan(minX(upright, 0) - minX(upright, 6))
  })
})
