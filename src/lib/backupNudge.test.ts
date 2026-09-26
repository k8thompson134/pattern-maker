import { beforeEach, describe, expect, it } from 'vitest'
import { acknowledgeBackup, recordEdit, shouldShowBackupNudge, type NudgeStorage } from './backupNudge'

function fakeStorage(): NudgeStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

let storage: NudgeStorage
beforeEach(() => {
  storage = fakeStorage()
})

describe('backup nudge', () => {
  it('does not nudge before enough edits', () => {
    for (let i = 0; i < 24; i++) recordEdit(storage)
    expect(shouldShowBackupNudge(storage)).toBe(false)
  })

  it('nudges once enough edits have piled up', () => {
    for (let i = 0; i < 25; i++) recordEdit(storage)
    expect(shouldShowBackupNudge(storage)).toBe(true)
  })

  it('acknowledging resets the count until the next batch of edits', () => {
    for (let i = 0; i < 25; i++) recordEdit(storage)
    acknowledgeBackup(storage)
    expect(shouldShowBackupNudge(storage)).toBe(false)
    for (let i = 0; i < 25; i++) recordEdit(storage)
    expect(shouldShowBackupNudge(storage)).toBe(true)
  })
})
