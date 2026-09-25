import type { Project } from './types'

const STORAGE_KEY = 'cross-stitch-tool:project'

// Returns whether the save actually succeeded — autosave is this app's only
// safety net (no backend), so a silently-swallowed quota-exceeded/private-
// browsing throw here would mean lost work with no signal to the user.
export function saveProject(project: Project): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    return true
  } catch {
    return false
  }
}

export function loadProject(): { project: Project | null; corrupted: boolean } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { project: null, corrupted: false }
  try {
    return { project: JSON.parse(raw) as Project, corrupted: false }
  } catch {
    return { project: null, corrupted: true }
  }
}
