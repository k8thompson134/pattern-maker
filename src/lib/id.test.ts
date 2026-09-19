import { describe, expect, it } from 'vitest'
import { createId } from './id'

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(createId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('falls back to a generated id when crypto.randomUUID is unavailable', () => {
    // simulates an insecure context (plain HTTP over a LAN/Tailscale hostname),
    // where the browser doesn't expose crypto.randomUUID at all
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const id = createId()
      expect(id).toMatch(/^id-\d+-[a-z0-9]+$/)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createId()))
    expect(ids.size).toBe(50)
  })
})
