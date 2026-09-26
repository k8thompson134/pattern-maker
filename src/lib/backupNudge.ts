// Tracks edits since the last PDF export (or the last time the nudge was dismissed)
// so App.tsx can show a periodic "back up your design" reminder. Separate
// localStorage key from the project blob — this is bookkeeping, not project data,
// and losing it (corrupt/cleared) should never affect the project itself.
const KEY = 'cross-stitch-tool:backup-nudge'
const NUDGE_AFTER_EDITS = 25

type NudgeState = { editCount: number; baseline: number }

// A minimal Storage-shaped interface so this stays unit-testable without jsdom
// (no other file in this repo pulls in a DOM test environment — see storage.ts,
// which is exercised via the puppeteer-core scratch pattern instead). Defaults
// to the real localStorage; tests pass an in-memory fake.
export type NudgeStorage = Pick<Storage, 'getItem' | 'setItem'>

function read(storage: NudgeStorage): NudgeState {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return { editCount: 0, baseline: 0 }
    const parsed = JSON.parse(raw)
    return { editCount: parsed.editCount ?? 0, baseline: parsed.baseline ?? 0 }
  } catch {
    return { editCount: 0, baseline: 0 }
  }
}

function write(storage: NudgeStorage, state: NudgeState): void {
  try {
    storage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Best-effort only — worst case the nudge just doesn't fire this session.
  }
}

export function recordEdit(storage: NudgeStorage = localStorage): void {
  const state = read(storage)
  write(storage, { ...state, editCount: state.editCount + 1 })
}

// Called after a successful export or when the user dismisses the nudge —
// either resets the clock on the next reminder.
export function acknowledgeBackup(storage: NudgeStorage = localStorage): void {
  const state = read(storage)
  write(storage, { ...state, baseline: state.editCount })
}

export function shouldShowBackupNudge(storage: NudgeStorage = localStorage): boolean {
  const state = read(storage)
  return state.editCount - state.baseline >= NUDGE_AFTER_EDITS
}
