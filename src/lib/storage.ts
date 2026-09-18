import type { Project } from './types'

const STORAGE_KEY = 'cross-stitch-tool:project'

export function saveProject(project: Project): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

export function loadProject(): Project | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Project
  } catch {
    return null
  }
}
