import { createId } from './id'
import type { Project } from './types'

// Pre-multi-project format: a single project under one key. Still read (and
// migrated into the map below) so upgrading doesn't lose anyone's design.
const LEGACY_KEY = 'cross-stitch-tool:project'
const PROJECTS_KEY = 'cross-stitch-tool:projects'
const ACTIVE_KEY = 'cross-stitch-tool:active-project-id'

type ProjectsMap = Record<string, Project>

function readProjectsMap(): { map: ProjectsMap; corrupted: boolean } {
  const raw = localStorage.getItem(PROJECTS_KEY)
  if (raw) {
    try {
      return { map: JSON.parse(raw) as ProjectsMap, corrupted: false }
    } catch {
      return { map: {}, corrupted: true }
    }
  }
  const legacyRaw = localStorage.getItem(LEGACY_KEY)
  if (!legacyRaw) return { map: {}, corrupted: false }
  try {
    const legacy = JSON.parse(legacyRaw) as Project
    return { map: { [legacy.id]: legacy }, corrupted: false }
  } catch {
    return { map: {}, corrupted: true }
  }
}

function writeProjectsMap(map: ProjectsMap): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

// Returns whether the save actually succeeded — autosave is this app's only
// safety net (no backend), so a silently-swallowed quota-exceeded/private-
// browsing throw here would mean lost work with no signal to the user.
export function saveProject(project: Project): boolean {
  const { map } = readProjectsMap()
  map[project.id] = project
  const ok = writeProjectsMap(map)
  if (ok) {
    try {
      localStorage.setItem(ACTIVE_KEY, project.id)
    } catch {
      // Non-fatal — worst case the app reopens the most-recently-updated
      // project instead of this exact one next launch.
    }
  }
  return ok
}

export function loadProject(): { project: Project | null; corrupted: boolean } {
  const { map, corrupted } = readProjectsMap()
  const activeId = localStorage.getItem(ACTIVE_KEY)
  if (activeId && map[activeId]) return { project: map[activeId], corrupted }
  const all = Object.values(map).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { project: all[0] ?? null, corrupted }
}

// Newest first, for a project-switcher list.
export function listProjects(): Project[] {
  return Object.values(readProjectsMap().map).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function setActiveProject(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    // Non-fatal — see saveProject.
  }
}

// "Save as": copies a project into a new slot with a fresh id, so editing the
// copy never touches the original. Does not switch the active project itself —
// callers that want the copy open should also call setActiveProject/saveProject.
export function duplicateProject(project: Project, name: string): Project {
  const copy: Project = {
    ...project,
    id: createId(),
    name,
    updatedAt: new Date().toISOString(),
  }
  saveProject(copy)
  return copy
}

export function deleteProject(id: string): void {
  const { map } = readProjectsMap()
  delete map[id]
  writeProjectsMap(map)
}
