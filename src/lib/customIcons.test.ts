import { describe, expect, it } from 'vitest'
import { customIconId, iconToPixelObject, iconToSource, loadCustomIcons, pixelObjectToIcon, saveCustomIcons } from './customIcons'
import { renderIconToCells } from './iconRender'
import { getIcon, setCustomIcons } from './icons'
import { paintCell } from './pixelObject'
import type { PixelObject, StitchColor } from './types'

const black: StitchColor = { dmcCode: '310', name: 'Black', hex: '#000000' }
const red: StitchColor = { dmcCode: '666', name: 'Red', hex: '#e31d42' }
const blue: StitchColor = { dmcCode: '797', name: 'Blue', hex: '#13477d' }

function draw(cells: [number, number, StitchColor][]): PixelObject {
  let obj: PixelObject = { id: 'p', kind: 'pixels', x: 0, y: 0, cells: [] }
  for (const [x, y, c] of cells) obj = paintCell(obj, x, y, c)
  return obj
}

describe('custom icons', () => {
  it('round-trips a built-in icon through a drawing without changing its stitches', () => {
    for (const id of ['heart', 'bee-striped', 'flower']) {
      const icon = getIcon(id)
      const result = pixelObjectToIcon(iconToPixelObject(icon, black, red, 40, 40), 'Copy')
      if (!result.ok) throw new Error(result.error)
      const positions = (i: typeof icon) => {
        const cells = renderIconToCells(i)
        const minX = Math.min(...cells.map((c) => c.dx))
        const minY = Math.min(...cells.map((c) => c.dy))
        return cells.map((c) => `${c.dx - minX},${c.dy - minY}`).sort()
      }
      expect(positions(result.icon)).toEqual(positions(icon))
    }
  })

  it('uses the most-used color as main and a second as accent', () => {
    const result = pixelObjectToIcon(draw([[0, 0, red], [1, 0, black], [2, 0, black]]), 'Two Tone')
    expect(result).toMatchObject({ ok: true, icon: { main: '310', accent: '666', rows: ['211'], width: 3, height: 1 } })
  })

  it('omits the accent for single-color drawings', () => {
    const result = pixelObjectToIcon(draw([[0, 0, red]]), 'One')
    expect(result.ok && 'accent' in result.icon).toBe(false)
  })

  it('refuses three colors, empty drawings and blank names', () => {
    expect(pixelObjectToIcon(draw([[0, 0, red], [1, 0, black], [2, 0, blue]]), 'X').ok).toBe(false)
    expect(pixelObjectToIcon(draw([]), 'X').ok).toBe(false)
    expect(pixelObjectToIcon(draw([[0, 0, red]]), '  ').ok).toBe(false)
  })

  it('same name gives the same id, so saving again overwrites', () => {
    expect(customIconId('Boba Tea!')).toBe('custom-boba-tea')
    expect(customIconId('  boba  tea ')).toBe('custom-boba-tea')
    expect(customIconId('!!!')).toBe('custom-icon')
  })

  it('centers the drawing on the canvas', () => {
    const icon = getIcon('heart')
    const obj = iconToPixelObject(icon, black, red, 41, 31)
    expect(obj.x).toBe(Math.floor((41 - icon.width) / 2))
    expect(obj.y).toBe(Math.floor((31 - icon.height) / 2))
  })

  it('resolves saved icons through getIcon and persists them', () => {
    const result = pixelObjectToIcon(draw([[0, 0, red], [1, 1, red]]), 'Diagonal')
    if (!result.ok) throw new Error(result.error)
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    saveCustomIcons([result.icon], storage)
    expect(loadCustomIcons(storage)).toEqual([result.icon])
    setCustomIcons(loadCustomIcons(storage))
    expect(getIcon('custom-diagonal').name).toBe('Diagonal')
    setCustomIcons([])
    expect(getIcon('custom-diagonal').id).not.toBe('custom-diagonal')
  })

  it('emits source in the built-in file shape without the custom prefix', () => {
    const result = pixelObjectToIcon(draw([[0, 0, red], [1, 0, red]]), "Kate's Thing")
    if (!result.ok) throw new Error(result.error)
    const src = iconToSource(result.icon, 'hobbies')
    expect(src).toContain("id: 'kate-s-thing',")
    expect(src).toContain("name: 'Kate\\'s Thing',")
    expect(src).toContain("group: 'hobbies',")
    expect(src).toContain("'11',")
  })

  it('loadCustomIcons tolerates missing or corrupt data', () => {
    expect(loadCustomIcons({ getItem: () => null, setItem: () => {} })).toEqual([])
    expect(loadCustomIcons({ getItem: () => '{oops', setItem: () => {} })).toEqual([])
  })
})
