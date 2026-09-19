import { describe, expect, it } from 'vitest'
import { measureIcon, renderIconToCells } from './iconRender'
import { ICON_LIBRARY, getIcon } from './icons'

describe('renderIconToCells', () => {
  it('renders every icon in the library with cells inside its declared bounds', () => {
    for (const icon of ICON_LIBRARY) {
      const cells = renderIconToCells(icon, 1)
      expect(cells.length).toBeGreaterThan(0)
      for (const c of cells) {
        expect(c.dx).toBeGreaterThanOrEqual(0)
        expect(c.dx).toBeLessThan(icon.width)
        expect(c.dy).toBeGreaterThanOrEqual(0)
        expect(c.dy).toBeLessThan(icon.height)
      }
    }
  })

  it('every row string matches the icon’s declared width', () => {
    for (const icon of ICON_LIBRARY) {
      for (const row of icon.rows) {
        expect(row.length).toBe(icon.width)
      }
      expect(icon.rows.length).toBe(icon.height)
    }
  })

  it('multiplies each icon pixel into an NxN block at higher scale', () => {
    const heart = getIcon('heart')
    const at1x = renderIconToCells(heart, 1)
    const at3x = renderIconToCells(heart, 3)
    expect(at3x.length).toBe(at1x.length * 9)
  })
})

describe('measureIcon', () => {
  it('scales width and height together', () => {
    const star = getIcon('star')
    expect(measureIcon(star, 1)).toEqual({ width: star.width, height: star.height })
    expect(measureIcon(star, 2)).toEqual({ width: star.width * 2, height: star.height * 2 })
  })
})

describe('getIcon', () => {
  it('falls back to the first icon for an unknown id', () => {
    expect(getIcon('does-not-exist')).toEqual(ICON_LIBRARY[0])
  })

  it('has no duplicate ids in the library', () => {
    const ids = ICON_LIBRARY.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
