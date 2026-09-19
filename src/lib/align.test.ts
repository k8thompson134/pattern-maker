import { describe, expect, it } from 'vitest'
import { alignObject } from './align'
import { getIcon } from './icons'
import type { IconObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const color = DMC_STARTER_COLORS[0]
// rose is 9 wide x 13 tall — deliberately non-square so a width/height mixup
// in the alignment math shows up as a wrong-axis result, not a coincidentally
// correct one (a square fixture could pass "right" align by accident using height).
const rose = getIcon('rose')

function makeIcon(x: number, y: number, scale = 1): IconObject {
  return { id: '1', kind: 'icon', iconId: 'rose', scale, x, y, color }
}

const CANVAS_W = 60
const CANVAS_H = 60

describe('alignObject', () => {
  it('left: sets x to 0, leaves y untouched', () => {
    const obj = makeIcon(20, 15)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'left')
    expect(aligned.x).toBe(0)
    expect(aligned.y).toBe(15)
  })

  it('right: sets x so the object’s right edge touches the canvas edge', () => {
    const obj = makeIcon(0, 15)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'right')
    expect(aligned.x).toBe(CANVAS_W - rose.width)
    expect(aligned.y).toBe(15)
  })

  it('center-h: centers horizontally using the object’s width, not height', () => {
    const obj = makeIcon(0, 15)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'center-h')
    expect(aligned.x).toBe(Math.floor((CANVAS_W - rose.width) / 2))
    expect(aligned.y).toBe(15)
  })

  it('top: sets y to 0, leaves x untouched', () => {
    const obj = makeIcon(20, 15)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'top')
    expect(aligned.y).toBe(0)
    expect(aligned.x).toBe(20)
  })

  it('bottom: sets y so the object’s bottom edge touches the canvas edge', () => {
    const obj = makeIcon(20, 0)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'bottom')
    expect(aligned.y).toBe(CANVAS_H - rose.height)
    expect(aligned.x).toBe(20)
  })

  it('center-v: centers vertically using the object’s height, not width', () => {
    const obj = makeIcon(20, 0)
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'center-v')
    expect(aligned.y).toBe(Math.floor((CANVAS_H - rose.height) / 2))
    expect(aligned.x).toBe(20)
  })

  it('clamps instead of going negative for an object larger than the canvas', () => {
    const obj = makeIcon(0, 0, 10) // rose at 10x is far bigger than a 60x60 canvas
    const aligned = alignObject(obj, CANVAS_W, CANVAS_H, 'right')
    expect(aligned.x).toBeGreaterThanOrEqual(0)
    const alignedBottom = alignObject(obj, CANVAS_W, CANVAS_H, 'bottom')
    expect(alignedBottom.y).toBeGreaterThanOrEqual(0)
  })
})
