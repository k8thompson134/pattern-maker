import { describe, expect, it } from 'vitest'
import { computeResizeFromHandle } from './resizeHandle'

// A 8x7 object (heart's real dimensions) sitting at stitch (10, 10) at scale 1,
// so its four corners are: nw=(10,10) ne=(18,10) sw=(10,17) se=(18,17).
const BASE_WIDTH = 8
const BASE_HEIGHT = 7
const MAX_SCALE = 3

describe('computeResizeFromHandle', () => {
  it('se handle: anchor is the fixed nw corner, object grows down-right', () => {
    // dragging se handle from (18,17) out to twice the base width away from the nw anchor (10,10)
    const result = computeResizeFromHandle({
      handle: 'se',
      anchorXStitch: 10,
      anchorYStitch: 10,
      pointerXStitch: 10 + BASE_WIDTH * 2,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(2)
    expect(result.x).toBe(10) // nw anchor stays put
    expect(result.y).toBe(10)
  })

  it('nw handle: anchor is the fixed se corner, object grows up-left', () => {
    // se anchor is at (18, 17); dragging nw handle out to 2x width to the left of it
    const result = computeResizeFromHandle({
      handle: 'nw',
      anchorXStitch: 18,
      anchorYStitch: 17,
      pointerXStitch: 18 - BASE_WIDTH * 2,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(2)
    // top-left of the new, bigger box = anchor minus the new width/height
    expect(result.x).toBe(18 - BASE_WIDTH * 2)
    expect(result.y).toBe(17 - BASE_HEIGHT * 2)
  })

  it('ne handle: anchor is the fixed sw corner, object grows up-right', () => {
    // sw anchor at (10, 17); dragging ne handle out to 2x width to the right
    const result = computeResizeFromHandle({
      handle: 'ne',
      anchorXStitch: 10,
      anchorYStitch: 17,
      pointerXStitch: 10 + BASE_WIDTH * 2,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(2)
    expect(result.x).toBe(10) // sw anchor's x is the left edge, stays put
    expect(result.y).toBe(17 - BASE_HEIGHT * 2) // sw anchor's y is the bottom edge
  })

  it('sw handle: anchor is the fixed ne corner, object grows down-left', () => {
    // ne anchor at (18, 10); dragging sw handle out to 2x width to the left
    const result = computeResizeFromHandle({
      handle: 'sw',
      anchorXStitch: 18,
      anchorYStitch: 10,
      pointerXStitch: 18 - BASE_WIDTH * 2,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(2)
    expect(result.x).toBe(18 - BASE_WIDTH * 2) // ne anchor's x is the right edge
    expect(result.y).toBe(10) // ne anchor's y is the top edge, stays put
  })

  it('clamps to maxScale even if dragged far past it', () => {
    const result = computeResizeFromHandle({
      handle: 'se',
      anchorXStitch: 0,
      anchorYStitch: 0,
      pointerXStitch: BASE_WIDTH * 50,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(MAX_SCALE)
  })

  it('never drops below scale 1 even if dragged back past the anchor', () => {
    const result = computeResizeFromHandle({
      handle: 'se',
      anchorXStitch: 20,
      anchorYStitch: 20,
      pointerXStitch: 20, // dragged all the way back onto the anchor itself
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      maxScale: MAX_SCALE,
    })
    expect(result.scale).toBe(1)
  })

  it('always produces an integer scale, never fractional', () => {
    for (let px = 0; px <= 200; px += 7) {
      const result = computeResizeFromHandle({
        handle: 'se',
        anchorXStitch: 0,
        anchorYStitch: 0,
        pointerXStitch: px,
        baseWidth: BASE_WIDTH,
        baseHeight: BASE_HEIGHT,
        maxScale: MAX_SCALE,
      })
      expect(Number.isInteger(result.scale)).toBe(true)
    }
  })
})
