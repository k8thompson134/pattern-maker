import type { BitmapFont } from './fonts'
import type { TextDirection } from './types'

export type FilledCell = { dx: number; dy: number }

const LETTER_SPACING = 1

export function renderTextToCells(
  text: string,
  font: BitmapFont,
  direction: TextDirection = 'horizontal',
  scale = 1,
): FilledCell[] {
  const cells: FilledCell[] = []
  let cursor = 0

  for (const rawChar of text) {
    const char = font.glyphs[rawChar] ? rawChar : rawChar.toUpperCase()
    const glyph = font.glyphs[char] ?? font.glyphs[' ']

    glyph.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '1') continue
        const baseDx = direction === 'horizontal' ? cursor + x : x
        const baseDy = direction === 'horizontal' ? y : cursor + y
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            cells.push({ dx: baseDx * scale + sx, dy: baseDy * scale + sy })
          }
        }
      }
    })

    cursor += direction === 'horizontal' ? font.cellWidth + LETTER_SPACING : font.cellHeight + LETTER_SPACING
  }

  return cells
}

export function measureText(
  text: string,
  font: BitmapFont,
  direction: TextDirection = 'horizontal',
  scale = 1,
): { width: number; height: number } {
  const length = text.length
  if (length === 0) return { width: 0, height: 0 }

  if (direction === 'horizontal') {
    const width = (length * font.cellWidth + (length - 1) * LETTER_SPACING) * scale
    return { width, height: font.cellHeight * scale }
  }

  const height = (length * font.cellHeight + (length - 1) * LETTER_SPACING) * scale
  return { width: font.cellWidth * scale, height }
}
