import { describe, expect, it } from 'vitest'
import { measureText, renderTextToCells } from './textRender'
import { FONT_BLOCK_5X7 } from './fonts'

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
    const cells = renderTextToCells('#', FONT_BLOCK_5X7, 'horizontal', 1)
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
