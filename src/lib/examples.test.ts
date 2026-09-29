import { describe, expect, it } from 'vitest'
import { buildCozyExample, buildGardenExample, buildWelcomeExample, EXAMPLES } from './examples'
import { renderObjectCells } from './objectCells'
import { measureObject } from './objectMeasure'

describe('cozy example', () => {
  const project = buildCozyExample(1)
  const inner = project.objects.filter((o) => o.kind !== 'pixels')

  it('fits on the canvas', () => {
    for (const o of project.objects) {
      const { width, height } = measureObject(o)
      expect(o.x).toBeGreaterThanOrEqual(0)
      expect(o.y).toBeGreaterThanOrEqual(0)
      expect(o.x + width).toBeLessThanOrEqual(project.widthStitches)
      expect(o.y + height).toBeLessThanOrEqual(project.heightStitches)
    }
  })

  it('has no overlapping stitches between the border and other objects or among them', () => {
    const seen = new Set<string>()
    for (const o of project.objects) {
      for (const c of o.kind === 'pixels' ? o.cells : renderObjectCells(o)) {
        const key = `${o.x + c.dx},${o.y + c.dy}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('uses only text and icons besides the border', () => {
    expect(inner.length).toBe(project.objects.length - 1)
  })
})

describe.each([
  ['garden sampler', buildGardenExample],
  ['birth announcement', buildWelcomeExample],
])('%s example', (_name, build) => {
  const project = build(1)

  it('fits on the canvas', () => {
    for (const o of project.objects) {
      const { width, height } = measureObject(o)
      expect(o.x).toBeGreaterThanOrEqual(0)
      expect(o.y).toBeGreaterThanOrEqual(0)
      expect(o.x + width).toBeLessThanOrEqual(project.widthStitches)
      expect(o.y + height).toBeLessThanOrEqual(project.heightStitches)
    }
  })

  it('has no overlapping stitches', () => {
    const seen = new Set<string>()
    for (const o of project.objects) {
      for (const c of o.kind === 'pixels' ? o.cells : renderObjectCells(o)) {
        const key = `${o.x + c.dx},${o.y + c.dy}`
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
    }
  })
})

it('lists every example with a unique id', () => {
  expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length)
})
