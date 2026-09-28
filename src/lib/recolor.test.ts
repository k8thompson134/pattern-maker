import { describe, expect, it } from 'vitest'
import { replaceColor } from './recolor'
import { DMC_STARTER_COLORS } from './dmcColors'
import type { CanvasObject } from './types'

const [black, , red, , , blue] = DMC_STARTER_COLORS

const text: CanvasObject = { id: 't', kind: 'text', content: 'A', font: 'block-5x7', direction: 'horizontal', scale: 1, x: 0, y: 0, rotation: 0, color: red }
const otherText: CanvasObject = { ...text, id: 't2', color: blue }
const pixels: CanvasObject = {
  id: 'p',
  kind: 'pixels',
  x: 0,
  y: 0,
  cells: [
    { dx: 0, dy: 0, color: red },
    { dx: 1, dy: 0, color: blue },
  ],
}

describe('replaceColor', () => {
  it('recolors text, icons and individual pixel cells that use the color', () => {
    const out = replaceColor([text, pixels], red.dmcCode, black)
    expect((out[0] as typeof text).color).toEqual(black)
    const cells = (out[1] as typeof pixels).cells
    expect(cells[0].color).toEqual(black)
    expect(cells[1].color).toEqual(blue)
  })

  it('leaves objects that do not use the color untouched (same reference)', () => {
    const out = replaceColor([otherText, pixels], black.dmcCode, red)
    expect(out[0]).toBe(otherText)
    expect(out[1]).toBe(pixels)
  })
})
