import type { BitmapFont } from './fonts'
import type { TextDirection } from './types'

export type FilledCell = { dx: number; dy: number; accent?: boolean }

const LETTER_SPACING = 1

function stripAccent(char: string): string {
  return char.normalize('NFD')[0]
}

// Exact glyph, then the uppercase glyph, then the same lookups on the accent-stripped
// base letter. Undefined when nothing fits.
export function findGlyph(font: BitmapFont, char: string): string[] | undefined {
  const direct = font.glyphs[char] ?? font.glyphs[char.toUpperCase()]
  if (direct) return direct
  const base = stripAccent(char)
  if (base === char) return undefined
  return font.glyphs[base] ?? font.glyphs[base.toUpperCase()]
}

function glyphFor(font: BitmapFont, char: string): string[] {
  return findGlyph(font, char) ?? font.glyphs[' ']
}

function charsOf(text: string): string[] {
  return [...text.normalize('NFC')]
}

function glyphWidth(glyph: string[]): number {
  return glyph[0].length
}

export function renderTextToCells(
  text: string,
  font: BitmapFont,
  direction: TextDirection = 'horizontal',
  scale = 1,
): FilledCell[] {
  const cells: FilledCell[] = []
  let cursor = 0

  for (const char of charsOf(text)) {
    const glyph = glyphFor(font, char)
    const width = glyphWidth(glyph)
    const across = direction === 'horizontal' ? 0 : Math.floor((font.cellWidth - width) / 2)

    glyph.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '1') continue
        const baseDx = direction === 'horizontal' ? cursor + x : across + x
        const baseDy = direction === 'horizontal' ? y : cursor + y
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            cells.push({ dx: baseDx * scale + sx, dy: baseDy * scale + sy })
          }
        }
      }
    })

    cursor += (direction === 'horizontal' ? width : font.cellHeight) + LETTER_SPACING
  }

  return cells
}

export function measureText(
  text: string,
  font: BitmapFont,
  direction: TextDirection = 'horizontal',
  scale = 1,
): { width: number; height: number } {
  const chars = charsOf(text)
  if (chars.length === 0) return { width: 0, height: 0 }

  if (direction === 'horizontal') {
    const advance = chars.reduce((sum, c) => sum + glyphWidth(glyphFor(font, c)), 0)
    const width = (advance + (chars.length - 1) * LETTER_SPACING) * scale
    return { width, height: font.cellHeight * scale }
  }

  const height = (chars.length * font.cellHeight + (chars.length - 1) * LETTER_SPACING) * scale
  return { width: font.cellWidth * scale, height }
}

// Characters with no usable glyph at all — these render as blanks. Space is always supported.
export function unsupportedChars(text: string, font: BitmapFont): string[] {
  const seen = new Set<string>()
  for (const char of charsOf(text)) {
    if (char === ' ') continue
    if (!findGlyph(font, char)) seen.add(char)
  }
  return [...seen]
}

// Accented characters this font draws as their plain base letter.
export function accentDroppedChars(text: string, font: BitmapFont): string[] {
  const seen = new Set<string>()
  for (const char of charsOf(text)) {
    if (font.glyphs[char] || font.glyphs[char.toUpperCase()]) continue
    if (findGlyph(font, char)) seen.add(char)
  }
  return [...seen]
}
