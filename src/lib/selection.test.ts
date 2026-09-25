import { describe, expect, it } from 'vitest'
import { clampSelectionDelta, cloneSelection, expandToGroups, nextSelection, selectionBounds } from './selection'
import type { PixelObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const color = DMC_STARTER_COLORS[0]

function box(id: string, x: number, y: number, w: number, h: number, groupId?: string): PixelObject {
  return { id, kind: 'pixels', x, y, groupId, cells: [{ dx: 0, dy: 0, color }, { dx: w - 1, dy: h - 1, color }] }
}

describe('expandToGroups', () => {
  const objects = [box('a', 0, 0, 1, 1, 'g1'), box('b', 5, 5, 1, 1, 'g1'), box('c', 9, 9, 1, 1)]

  it('selecting one group member selects the whole group', () => {
    expect(expandToGroups(['a'], objects)).toEqual(['a', 'b'])
  })

  it('leaves ungrouped objects alone', () => {
    expect(expandToGroups(['c'], objects)).toEqual(['c'])
  })

  it('handles an empty selection', () => {
    expect(expandToGroups([], objects)).toEqual([])
  })
})

describe('selectionBounds', () => {
  it('returns the union bounding box', () => {
    expect(selectionBounds([box('a', 2, 3, 4, 2), box('b', 10, 1, 3, 3)])).toEqual({ x: 2, y: 1, width: 11, height: 4 })
  })

  it('returns null for nothing selected', () => {
    expect(selectionBounds([])).toBeNull()
  })
})

describe('clampSelectionDelta', () => {
  const bounds = { x: 2, y: 2, width: 10, height: 5 }

  it('passes an in-bounds delta through unchanged', () => {
    expect(clampSelectionDelta(bounds, 3, 4, 60, 60)).toEqual({ dx: 3, dy: 4 })
  })

  it('stops the whole selection at the left/top edge', () => {
    expect(clampSelectionDelta(bounds, -10, -10, 60, 60)).toEqual({ dx: -2, dy: -2 })
  })

  it('stops the whole selection at the right/bottom edge', () => {
    expect(clampSelectionDelta(bounds, 100, 100, 20, 20)).toEqual({ dx: 8, dy: 13 })
  })
})

describe('cloneSelection', () => {
  it('gives copies fresh ids and offsets them', () => {
    const [copy] = cloneSelection([box('a', 1, 1, 1, 1)], 3, 0)
    expect(copy.id).not.toBe('a')
    expect(copy.x).toBe(4)
    expect(copy.groupId).toBeUndefined()
  })

  it('maps each source group to one fresh group', () => {
    const copies = cloneSelection([box('a', 0, 0, 1, 1, 'g1'), box('b', 2, 0, 1, 1, 'g1'), box('c', 4, 0, 1, 1, 'g2')], 0, 0)
    expect(copies[0].groupId).toBeDefined()
    expect(copies[0].groupId).not.toBe('g1')
    expect(copies[1].groupId).toBe(copies[0].groupId)
    expect(copies[2].groupId).not.toBe(copies[0].groupId)
    expect(copies[2].groupId).not.toBe('g2')
  })
})

describe('nextSelection', () => {
  const objects = [box('a', 0, 0, 1, 1, 'g1'), box('b', 5, 5, 1, 1, 'g1'), box('c', 9, 9, 1, 1), box('d', 12, 12, 1, 1)]

  it('replaces the selection with the clicked group', () => {
    expect(nextSelection(['c'], 'a', false, objects)).toEqual(['a', 'b'])
  })

  it('keeps a multi-selection when clicking one of its members', () => {
    expect(nextSelection(['c', 'd'], 'c', false, objects)).toEqual(['c', 'd'])
  })

  it('additive click adds the whole group', () => {
    expect(nextSelection(['c'], 'b', true, objects)).toEqual(['c', 'a', 'b'])
  })

  it('additive click on a selected member removes its whole group', () => {
    expect(nextSelection(['a', 'b', 'c'], 'a', true, objects)).toEqual(['c'])
  })
})
