import { describe, expect, it } from 'vitest'
import { flattenProject, summarizeColors } from './flattenProject'
import { createEmptyProject } from './types'
import type { IconObject, PixelObject, TextObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const red = DMC_STARTER_COLORS[2]
const blue = DMC_STARTER_COLORS[5]

describe('flattenProject', () => {
  it('flattens a text object into absolute-position cells with its color', () => {
    const project = createEmptyProject('t')
    const text: TextObject = {
      id: '1',
      kind: 'text',
      content: 'I',
      font: 'block-5x7',
      direction: 'horizontal',
      scale: 1,
      x: 10,
      y: 10,
      color: red,
    }
    project.objects = [text]
    const cells = flattenProject(project)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(10)
      expect(c.y).toBeGreaterThanOrEqual(10)
      expect(c.color).toBe(red)
    }
  })

  it('flattens a pixels object using each cell’s own color, ignoring nothing', () => {
    const project = createEmptyProject('t')
    const pixels: PixelObject = {
      id: '1',
      kind: 'pixels',
      x: 5,
      y: 5,
      cells: [
        { dx: 0, dy: 0, color: red },
        { dx: 1, dy: 0, color: blue },
      ],
    }
    project.objects = [pixels]
    const cells = flattenProject(project)
    expect(cells).toContainEqual({ x: 5, y: 5, color: red })
    expect(cells).toContainEqual({ x: 6, y: 5, color: blue })
  })

  it('a later object in the array overwrites an earlier one at the same cell (z-order)', () => {
    const project = createEmptyProject('t')
    const bottomIcon: IconObject = { id: '1', kind: 'icon', iconId: 'square', scale: 1, x: 0, y: 0, color: red }
    const topPixel: PixelObject = {
      id: '2',
      kind: 'pixels',
      x: 0,
      y: 0,
      cells: [{ dx: 0, dy: 0, color: blue }],
    }
    project.objects = [bottomIcon, topPixel]
    const cells = flattenProject(project)
    const cellAtOrigin = cells.find((c) => c.x === 0 && c.y === 0)
    expect(cellAtOrigin?.color).toBe(blue)
  })

  it('returns an empty array for a project with no objects', () => {
    expect(flattenProject(createEmptyProject('t'))).toEqual([])
  })
})

describe('summarizeColors', () => {
  it('counts stitches per color and sorts by count descending', () => {
    const cells = [
      { x: 0, y: 0, color: red },
      { x: 1, y: 0, color: red },
      { x: 2, y: 0, color: blue },
    ]
    const summary = summarizeColors(cells)
    expect(summary).toEqual([
      { color: red, count: 2 },
      { color: blue, count: 1 },
    ])
  })

  it('returns an empty array for no cells', () => {
    expect(summarizeColors([])).toEqual([])
  })
})
