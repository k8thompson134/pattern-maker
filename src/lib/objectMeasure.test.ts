import { describe, expect, it } from 'vitest'
import { clampToCanvas, measureObject } from './objectMeasure'
import { getIcon } from './icons'
import type { IconObject, TextObject } from './types'
import { DMC_STARTER_COLORS } from './dmcColors'

const color = DMC_STARTER_COLORS[0]
const heart = getIcon('heart')

describe('measureObject', () => {
  it('measures a text object using its font, direction, and scale', () => {
    const text: TextObject = {
      id: '1',
      kind: 'text',
      content: 'HI',
      font: 'block-5x7',
      direction: 'horizontal',
      scale: 1,
      x: 0,
      y: 0,
      color,
    }
    expect(measureObject(text)).toEqual({ width: 11, height: 7 })
  })

  it('measures an icon object using its scale', () => {
    const icon: IconObject = {
      id: '1',
      kind: 'icon',
      iconId: 'heart',
      scale: 2,
      x: 0,
      y: 0,
      color,
    }
    expect(measureObject(icon)).toEqual({ width: heart.width * 2, height: heart.height * 2 })
  })
})

describe('clampToCanvas', () => {
  it('leaves an object alone when it already fits', () => {
    const icon: IconObject = { id: '1', kind: 'icon', iconId: 'heart', scale: 1, x: 5, y: 5, color }
    expect(clampToCanvas(icon, 60, 60)).toEqual(icon)
  })

  it('pulls an object back on-canvas after a scale-up pushes it past the edge', () => {
    // centered near x=55 on a 60-wide canvas, then scaled 3x would run off the edge
    const icon: IconObject = { id: '1', kind: 'icon', iconId: 'heart', scale: 1, x: 55, y: 55, color }
    const scaledUp = clampToCanvas({ ...icon, scale: 3 }, 60, 60)
    expect(scaledUp.x).toBeLessThanOrEqual(60 - heart.width * 3)
    expect(scaledUp.y).toBeLessThanOrEqual(60 - heart.height * 3)
  })

  it('never produces a negative position even if the object is larger than the canvas', () => {
    const icon: IconObject = { id: '1', kind: 'icon', iconId: 'heart', scale: 10, x: 0, y: 0, color }
    const clamped = clampToCanvas(icon, 5, 5)
    expect(clamped.x).toBeGreaterThanOrEqual(0)
    expect(clamped.y).toBeGreaterThanOrEqual(0)
  })
})
