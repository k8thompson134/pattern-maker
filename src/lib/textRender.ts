import type { BitmapFont } from './fonts'

export type FilledCell = { dx: number; dy: number }

const LETTER_SPACING = 1

export function renderTextToCells(text: string, font: BitmapFont): FilledCell[] {
  const cells: FilledCell[] = []
  let cursorX = 0

  for (const rawChar of text) {
    const char = font.glyphs[rawChar] ? rawChar : rawChar.toUpperCase()
    const glyph = font.glyphs[char] ?? font.glyphs[' ']

    glyph.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '1') {
          cells.push({ dx: cursorX + x, dy: y })
        }
      }
    })

    cursorX += font.cellWidth + LETTER_SPACING
  }

  return cells
}

export function measureText(text: string, font: BitmapFont): { width: number; height: number } {
  const length = text.length
  const width = length === 0 ? 0 : length * font.cellWidth + (length - 1) * LETTER_SPACING
  return { width, height: font.cellHeight }
}
