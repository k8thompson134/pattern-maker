import { describe, expect, it } from 'vitest'
import { accentColorOf, cellColor, iconHasAccent, newIconColors, objectColors } from './iconColors'
import { ICON_GROUPS, ICON_LIBRARY, getIcon } from './icons'
import { renderObjectCells, rotateCells } from './objectCells'
import { renderIconToCells } from './iconRender'
import { flattenProject } from './flattenProject'
import { replaceColor } from './recolor'
import { createEmptyProject } from './types'
import type { IconObject } from './types'
import { DMC_PALETTE } from './dmcPalette'
import { DMC_STARTER_COLORS } from './dmcColors'

const yellow = DMC_PALETTE.find((c) => c.dmcCode === '726')!
const red = DMC_STARTER_COLORS[3]

function bee(patch: Partial<IconObject> = {}): IconObject {
  return { id: 'b', kind: 'icon', iconId: 'bee-striped', scale: 1, x: 0, y: 0, rotation: 0, color: yellow, ...patch }
}

describe('two-tone icons', () => {
  it('every library icon uses only 0/1/2, sits in a known group, and has resolvable default colors', () => {
    const groups = ICON_GROUPS.map((g) => g.id) as string[]
    for (const icon of ICON_LIBRARY) {
      expect(groups).toContain(icon.group)
      for (const row of icon.rows) expect(row).toMatch(/^[012]+$/)
      const defaults = newIconColors(icon, red)
      expect(defaults.color.dmcCode).toBeTruthy()
      if (iconHasAccent(icon)) expect(defaults.color2).toBeDefined()
    }
  })

  it('marks only "2" stitches as accent and scales them with the icon', () => {
    const icon = getIcon('bee-striped')
    const accents = renderIconToCells(icon, 2).filter((c) => c.accent)
    const single = renderIconToCells(icon, 1).filter((c) => c.accent)
    expect(single.length).toBeGreaterThan(0)
    expect(accents.length).toBe(single.length * 4)
    expect(renderIconToCells(getIcon('heart'), 1).some((c) => c.accent)).toBe(false)
  })

  it('rotation keeps every stitch on its layer', () => {
    const cells = renderObjectCells(bee())
    const rotated = renderObjectCells(bee({ rotation: 90 }))
    expect(rotated.filter((c) => c.accent).length).toBe(cells.filter((c) => c.accent).length)
    const probe = rotateCells([{ dx: 0, dy: 0, accent: true }, { dx: 1, dy: 0 }], 2, 1, 90)
    expect(probe.map((c) => !!c.accent)).toEqual([true, false])
  })

  it('accent color falls back to the icon default, then follows color2', () => {
    expect(accentColorOf(bee()).dmcCode).toBe('310')
    expect(accentColorOf(bee({ color2: red })).dmcCode).toBe(red.dmcCode)
  })

  it('cellColor picks the accent only for accent cells of icons', () => {
    const obj = bee({ color2: red })
    expect(cellColor(obj, { dx: 0, dy: 0, accent: true })).toBe(red)
    expect(cellColor(obj, { dx: 0, dy: 0 })).toBe(yellow)
  })

  it('flattenProject stitches accent cells in the accent color', () => {
    const project = createEmptyProject('t')
    project.objects = [bee({ color2: red })]
    const cells = flattenProject(project)
    const codes = new Set(cells.map((c) => c.color.dmcCode))
    expect(codes).toEqual(new Set([yellow.dmcCode, red.dmcCode]))
  })

  it('objectColors lists main and accent for two-tone icons, only main for single-tone', () => {
    expect(objectColors(bee()).map((c) => c.dmcCode)).toEqual(['726', '310'])
    expect(objectColors(bee({ iconId: 'heart' })).map((c) => c.dmcCode)).toEqual(['726'])
  })

  it('replaceColor swaps the accent without touching the main color, and the reverse', () => {
    const [swappedAccent] = replaceColor([bee()], '310', red) as IconObject[]
    expect(swappedAccent.color.dmcCode).toBe('726')
    expect(swappedAccent.color2?.dmcCode).toBe(red.dmcCode)
    const [swappedMain] = replaceColor([bee()], '726', red) as IconObject[]
    expect(swappedMain.color.dmcCode).toBe(red.dmcCode)
    expect(swappedMain.color2).toBeUndefined()
  })
})
