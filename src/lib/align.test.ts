import { describe, expect, it } from 'vitest'
import { alignUnits, type Alignment, countUnits, distributeUnits } from './align'
import { inkBounds, inkUnionBounds } from './inkBounds'
import type { TextObject } from './types'
import { measureObject } from './objectMeasure'
import { getIcon } from './icons'
import type { IconObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const color = DMC_STARTER_COLORS[0]
// rose is 9 wide x 13 tall — deliberately non-square so a width/height mixup
// in the alignment math shows up as a wrong-axis result, not a coincidentally
// correct one (a square fixture could pass "right" align by accident using height).
const rose = getIcon('rose')

function makeIcon(x: number, y: number, scale = 1): IconObject {
  return { id: '1', kind: 'icon', iconId: 'rose', scale, x, y, rotation: 0, color }
}

const CANVAS_W = 60
const CANVAS_H = 60

const wholeCanvas = { x: 0, y: 0, width: 60, height: 60 }
const alignOne = <T extends IconObject>(o: T, a: Alignment): T => alignUnits([o], a, wholeCanvas, 60, 60)[0] as T

describe('single-object alignment to the canvas', () => {
  it('left: sets x to 0, leaves y untouched', () => {
    const obj = makeIcon(20, 15)
    const aligned = alignOne(obj, 'left')
    expect(aligned.x).toBe(0)
    expect(aligned.y).toBe(15)
  })

  it('right: sets x so the object’s right edge touches the canvas edge', () => {
    const obj = makeIcon(0, 15)
    const aligned = alignOne(obj, 'right')
    expect(aligned.x).toBe(CANVAS_W - rose.width)
    expect(aligned.y).toBe(15)
  })

  it('center-h: centers horizontally using the object’s width, not height', () => {
    const obj = makeIcon(0, 15)
    const aligned = alignOne(obj, 'center-h')
    expect(aligned.x).toBe(Math.floor((CANVAS_W - rose.width) / 2))
    expect(aligned.y).toBe(15)
  })

  it('top: sets y to 0, leaves x untouched', () => {
    const obj = makeIcon(20, 15)
    const aligned = alignOne(obj, 'top')
    expect(aligned.y).toBe(0)
    expect(aligned.x).toBe(20)
  })

  it('bottom: sets y so the object’s bottom edge touches the canvas edge', () => {
    const obj = makeIcon(20, 0)
    const aligned = alignOne(obj, 'bottom')
    expect(aligned.y).toBe(CANVAS_H - rose.height)
    expect(aligned.x).toBe(20)
  })

  it('center-v: centers vertically using the object’s height, not width', () => {
    const obj = makeIcon(20, 0)
    const aligned = alignOne(obj, 'center-v')
    expect(aligned.y).toBe(Math.floor((CANVAS_H - rose.height) / 2))
    expect(aligned.x).toBe(20)
  })

  it('clamps instead of going negative for an object larger than the canvas', () => {
    const obj = makeIcon(0, 0, 10) // rose at 10x is far bigger than a 60x60 canvas
    const aligned = alignOne(obj, 'right')
    expect(aligned.x).toBeGreaterThanOrEqual(0)
    const alignedBottom = alignOne(obj, 'bottom')
    expect(alignedBottom.y).toBeGreaterThanOrEqual(0)
  })
})

describe('alignUnits', () => {
  const icon = (id: string, iconId: string, x: number, y: number, groupId?: string): IconObject => ({
    id,
    kind: 'icon',
    iconId,
    scale: 1,
    x,
    y,
    rotation: 0,
    color,
    groupId,
  })
  const box = (o: IconObject) => {
    const { width, height } = measureObject(o)
    return { x: o.x, y: o.y, width, height }
  }
  const canvas = { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }

  it('aligns every object to the left edge of the selection', () => {
    const a = icon('a', 'rose', 10, 5)
    const b = icon('b', 'rose', 25, 30)
    const c = icon('c', 'rose', 40, 12)
    const [na, nb, nc] = alignUnits([a, b, c], 'left', inkUnionBounds([a, b, c])!, CANVAS_W, CANVAS_H)
    expect([na.x, nb.x, nc.x]).toEqual([10, 10, 10])
    expect([na.y, nb.y, nc.y]).toEqual([5, 30, 12])
  })

  it('right-aligns objects of different widths on their right edges', () => {
    const wide = icon('w', 'rose', 5, 5)
    const narrow = icon('n', 'tiny-bat', 30, 30)
    const [nw, nn] = alignUnits([wide, narrow], 'right', inkUnionBounds([wide, narrow])!, CANVAS_W, CANVAS_H)
    expect(nw.x + measureObject(nw).width).toBe(nn.x + measureObject(nn).width)
  })

  it('centers each object on the reference in both axes', () => {
    const a = icon('a', 'rose', 2, 2)
    const b = icon('b', 'tiny-bat', 40, 44)
    const [na, nb] = alignUnits([a, b], 'center-h', canvas, CANVAS_W, CANVAS_H)
    expect(na.x).toBe(Math.floor((CANVAS_W - box(a).width) / 2))
    expect(nb.x).toBe(Math.floor((CANVAS_W - box(b).width) / 2))
    const [ma, mb] = alignUnits([a, b], 'center-v', canvas, CANVAS_W, CANVAS_H)
    expect(ma.y).toBe(Math.floor((CANVAS_H - box(a).height) / 2))
    expect(mb.y).toBe(Math.floor((CANVAS_H - box(b).height) / 2))
  })

  it('moves a group as one unit and keeps its members’ arrangement', () => {
    const g1 = icon('g1', 'rose', 10, 10, 'g')
    const g2 = icon('g2', 'rose', 30, 25, 'g')
    const loose = icon('l', 'rose', 45, 5)
    const [n1, n2, nl] = alignUnits([g1, g2, loose], 'left', inkUnionBounds([g1, g2, loose])!, CANVAS_W, CANVAS_H)
    expect(n2.x - n1.x).toBe(20)
    expect(n2.y - n1.y).toBe(15)
    expect(nl.x).toBe(n1.x)
  })

  it('never pushes a unit off the canvas', () => {
    const a = icon('a', 'rose', 50, 5)
    const [na] = alignUnits([a], 'right', { x: 0, y: 0, width: 80, height: 80 }, CANVAS_W, CANVAS_H)
    expect(na.x + measureObject(na).width).toBeLessThanOrEqual(CANVAS_W)
  })

  it('counts groups as one unit', () => {
    expect(countUnits([icon('a', 'rose', 0, 0, 'g'), icon('b', 'rose', 9, 0, 'g'), icon('c', 'rose', 20, 0)])).toBe(2)
  })
})

describe('distributeUnits', () => {
  const rose = (id: string, x: number, y: number, groupId?: string): IconObject => ({
    id,
    kind: 'icon',
    iconId: 'rose',
    scale: 1,
    x,
    y,
    rotation: 0,
    color,
    groupId,
  })
  const gapsX = (objs: IconObject[]) => {
    const sorted = [...objs].sort((a, b) => a.x - b.x)
    return sorted.slice(1).map((o, i) => o.x - (sorted[i].x + measureObject(sorted[i]).width))
  }

  it('equalizes horizontal gaps and pins the outermost objects', () => {
    const objs = [rose('a', 2, 4), rose('b', 15, 4), rose('c', 20, 4), rose('d', 50, 4)]
    const out = distributeUnits(objs, 'horizontal') as IconObject[]
    expect(out[0].x).toBe(2)
    expect(out[3].x).toBe(50)
    const gaps = gapsX(out)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
    expect(out.every((o) => o.y === 4)).toBe(true)
  })

  it('hands the remainder to the leading gaps', () => {
    const objs = [rose('a', 0, 0), rose('b', 11, 0), rose('c', 31, 0)]
    const out = distributeUnits(objs, 'horizontal') as IconObject[]
    expect(gapsX(out)).toEqual([7, 6])
  })

  it('distributes vertically without touching x', () => {
    const objs = [rose('a', 5, 0), rose('b', 9, 3), rose('c', 7, 40)]
    const out = distributeUnits(objs, 'vertical') as IconObject[]
    expect(out.map((o) => o.x)).toEqual([5, 9, 7])
    expect(out[0].y).toBe(0)
    expect(out[2].y).toBe(40)
    const [ay, by, cy] = out.map((o) => o.y)
    expect(by - (ay + 13)).toBeGreaterThanOrEqual(0)
    expect(cy - (by + 13) - (by - (ay + 13))).toBeLessThanOrEqual(1)
  })

  it('does nothing with fewer than three units', () => {
    const objs = [rose('a', 0, 0), rose('b', 30, 0)]
    expect(distributeUnits(objs, 'horizontal')).toBe(objs)
    const grouped = [rose('a', 0, 0, 'g'), rose('b', 15, 0, 'g'), rose('c', 40, 0)]
    expect(distributeUnits(grouped, 'horizontal')).toBe(grouped)
  })

  it('keeps grouped members together while spacing units', () => {
    const objs = [rose('a', 0, 0), rose('g1', 12, 0, 'g'), rose('g2', 22, 0, 'g'), rose('z', 60, 0)]
    const out = distributeUnits(objs, 'horizontal') as IconObject[]
    expect(out[2].x - out[1].x).toBe(10)
  })
})

describe('aligning by actual stitches', () => {
  const canvas = { x: 0, y: 0, width: 60, height: 60 }
  const moon: IconObject = { id: 'm', kind: 'icon', iconId: 'moon', scale: 1, x: 5, y: 5, rotation: 0, color }

  it('centers the stitches, not the declared box, for an icon with blank columns', () => {
    expect(measureObject(moon).width).toBeGreaterThan(inkBounds(moon).width)
    const [centered] = alignUnits([moon], 'center-h', canvas, 60, 60)
    const ink = inkBounds(centered)
    expect(ink.x).toBe(Math.floor((60 - ink.width) / 2))
  })

  it('centers lowercase text vertically by its stitches, not its 9-row cell', () => {
    const word: TextObject = { id: 't', kind: 'text', content: 'welcome', font: 'mixed-5x9', direction: 'horizontal', scale: 1, x: 5, y: 5, rotation: 0, color }
    expect(inkBounds(word).height).toBeLessThan(measureObject(word).height)
    const [centered] = alignUnits([word], 'center-v', canvas, 60, 60)
    const ink = inkBounds(centered)
    expect(ink.y).toBe(Math.floor((60 - ink.height) / 2))
  })

  it('aligns to another object’s stitches', () => {
    const target: IconObject = { ...moon, id: 't', x: 30, y: 40 }
    const [aligned] = alignUnits([moon], 'left', inkBounds(target), 60, 60)
    expect(inkBounds(aligned).x).toBe(inkBounds(target).x)
    expect(aligned.y).toBe(moon.y)
  })

  it('aligns to a margin inside the canvas', () => {
    const inset = { x: 4, y: 4, width: 52, height: 52 }
    const [left] = alignUnits([moon], 'left', inset, 60, 60)
    const [top] = alignUnits([moon], 'top', inset, 60, 60)
    expect(inkBounds(left).x).toBe(4)
    expect(inkBounds(top).y).toBe(4)
  })
})
