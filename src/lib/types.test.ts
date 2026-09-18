import { describe, expect, it } from 'vitest'
import { createEmptyProject, DEFAULT_FABRIC } from './types'

describe('createEmptyProject', () => {
  it('starts with an empty object list and the default fabric count', () => {
    const project = createEmptyProject('My Design')
    expect(project.name).toBe('My Design')
    expect(project.objects).toEqual([])
    expect(project.fabric).toEqual(DEFAULT_FABRIC)
    expect(project.zoom).toBe(1)
  })

  it('gives each project a unique id', () => {
    const a = createEmptyProject('A')
    const b = createEmptyProject('B')
    expect(a.id).not.toBe(b.id)
  })
})
