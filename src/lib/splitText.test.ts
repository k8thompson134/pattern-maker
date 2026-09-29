import { describe, expect, it } from 'vitest'
import { AVAILABLE_FONTS } from './fonts'
import { renderObjectCells } from './objectCells'
import { splitTextObject } from './splitText'
import { DMC_STARTER_COLORS } from './dmcColors'
import type { TextDirection, TextObject } from './types'

function stitches(objects: TextObject[]): string[] {
  return objects.flatMap((o) => renderObjectCells(o).map((c) => `${o.x + c.dx},${o.y + c.dy}`)).sort()
}

function text(overrides: Partial<TextObject>): TextObject {
  return {
    id: 'src',
    kind: 'text',
    content: 'Hi there',
    font: AVAILABLE_FONTS[0].id,
    direction: 'horizontal',
    scale: 1,
    x: 11,
    y: 13,
    rotation: 0,
    color: DMC_STARTER_COLORS[0],
    ...overrides,
  }
}

describe('splitTextObject', () => {
  it('stitches exactly the same cells as the whole string for every font, direction, scale and rotation', () => {
    const directions: TextDirection[] = ['horizontal', 'vertical']
    for (const font of AVAILABLE_FONTS) {
      for (const direction of directions) {
        for (const scale of [1, 2, 3]) {
          for (const rotation of [0, 90, 180, 270]) {
            const source = text({ font: font.id, direction, scale, rotation, content: 'Café Bee' })
            const label = `${font.id} ${direction} x${scale} @${rotation}`
            expect(stitches(splitTextObject(source)), label).toEqual(stitches([source]))
          }
        }
      }
    }
  })

  it('stays identical to the whole string when mirrored, for every rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      for (const [mirrorH, mirrorV] of [[true, false], [false, true], [true, true]]) {
        for (const direction of ['horizontal', 'vertical'] as TextDirection[]) {
          const source = text({ font: 'mixed-5x9', direction, scale: 2, rotation, mirrorH, mirrorV, content: 'Café Bee' })
          expect(stitches(splitTextObject(source)), `${direction} @${rotation} H${mirrorH} V${mirrorV}`).toEqual(stitches([source]))
        }
      }
    }
  })

  it('makes one object per non-space character, each with a fresh id', () => {
    const letters = splitTextObject(text({ content: 'A B  C' }))
    expect(letters.map((l) => l.content)).toEqual(['A', 'B', 'C'])
    expect(new Set(letters.map((l) => l.id)).size).toBe(3)
    expect(letters.every((l) => l.id !== 'src')).toBe(true)
  })

  it('carries font, color, scale, rotation and group membership onto every letter', () => {
    const source = text({ scale: 2, rotation: 90, groupId: 'g1', color: DMC_STARTER_COLORS[3] })
    for (const letter of splitTextObject(source)) {
      expect(letter).toMatchObject({ font: source.font, scale: 2, rotation: 90, groupId: 'g1', color: source.color })
    }
  })

  it('returns nothing for whitespace-only text', () => {
    expect(splitTextObject(text({ content: '   ' }))).toEqual([])
  })
})
