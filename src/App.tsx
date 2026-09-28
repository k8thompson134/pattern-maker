import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasGrid, CELL_SIZE } from './components/CanvasGrid'
import { ColorSwatchPicker } from './components/ColorSwatchPicker'
import { IconThumb } from './components/IconThumb'
import { createEmptyProject, type IconObject, type Project, type TextDirection, type TextObject } from './lib/types'
import { duplicateProject, listProjects, loadProject, saveProject, setActiveProject, deleteProject } from './lib/storage'
import { AVAILABLE_FONTS, getFont } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { measureText, unsupportedChars } from './lib/textRender'
import { ICON_LIBRARY, MINI_ICON_LIBRARY, getIcon } from './lib/icons'
import { measureIcon } from './lib/iconRender'
import { clampToCanvas, measureObject, MAX_OBJECT_SCALE } from './lib/objectMeasure'
import { createId } from './lib/id'
import { alignObject, type Alignment } from './lib/align'
import { createEmptyPixelObject, eraseCell, paintCell } from './lib/pixelObject'
import { exportProjectToPdf } from './lib/exportPdf'
import { assignSymbols, symbolTextIsBlack } from './lib/chartLayout'
import { flattenProject, summarizeColors } from './lib/flattenProject'
import { acknowledgeBackup, recordEdit, shouldShowBackupNudge } from './lib/backupNudge'
import { clampSelectionDelta, cloneSelection, selectionBounds } from './lib/selection'
import { useIsMobile } from './useIsMobile'
import './App.css'

type ToolTab = 'text' | 'icons' | 'stamp' | 'draw' | 'canvas'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5

type ProjectHistory = { past: Project[]; present: Project; future: Project[] }

const HISTORY_LIMIT = 50
// Rapid-fire edits to the same field (typing into the placed-text content box)
// coalesce into one undo step instead of one per keystroke — pass the same
// coalesceKey to setProject calls that should merge this way while they keep
// landing within this window of each other.
const COALESCE_WINDOW_MS = 800

function App() {
  const [initialLoad] = useState(() => loadProject())
  const [history, setHistory] = useState<ProjectHistory>(() => ({
    past: [],
    present: initialLoad.project ?? createEmptyProject('Untitled'),
    future: [],
  }))
  const project = history.present
  const lastCoalesce = useRef<{ key: string | null; time: number }>({ key: null, time: 0 })

  // Mirrors useState's dual signature (value or updater) so the ~20 existing
  // call sites that already do `setProject((p) => ({...}))` need no changes.
  // The undo/redo guard lives inside the updater passed to setHistory (not as
  // a check against the outer `history` closure) so a stale-closure call from
  // the keyboard-shortcut effect still reads live state — see handleKeyDown.
  function setProject(updater: Project | ((p: Project) => Project), coalesceKey?: string) {
    // The coalesce decision (and the ref mutation that records it) happens here,
    // outside the updater passed to setHistory — React (StrictMode in dev) can
    // invoke that updater twice to check purity, and a ref mutated inside it
    // would get stamped twice, making the *first* keystroke of a new coalesce
    // key see its own just-written stamp and wrongly merge into the prior step.
    const now = Date.now()
    const canCoalesce =
      !!coalesceKey && coalesceKey === lastCoalesce.current.key && now - lastCoalesce.current.time < COALESCE_WINDOW_MS
    lastCoalesce.current = { key: coalesceKey ?? null, time: now }
    setHistory((h) => {
      const nextPresent = typeof updater === 'function' ? (updater as (p: Project) => Project)(h.present) : updater
      if (nextPresent === h.present) return h
      if (canCoalesce) return { ...h, present: nextPresent }
      const past = [...h.past, h.present]
      if (past.length > HISTORY_LIMIT) past.shift()
      return { past, present: nextPresent, future: [] }
    })
  }

  // Zoom is view state, not a design edit — update it without touching the
  // undo/redo stacks at all (not even coalesced into an adjacent step).
  function updateZoomSilently(updater: (p: Project) => Project) {
    setHistory((h) => {
      const nextPresent = updater(h.present)
      if (nextPresent === h.present) return h
      return { ...h, present: nextPresent }
    })
  }

  // Whole-project replacement (new/switch/save-as/delete) starts a fresh
  // undo history rather than treating the old design as an undo step away.
  function resetHistory(next: Project) {
    lastCoalesce.current = { key: null, time: 0 }
    setHistory({ past: [], present: next, future: [] })
  }

  function undo() {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
    })
    // Selection isn't force-cleared here — a step that only edited an object
    // (moved/recolored/retyped) should leave it selected after undo/redo, not
    // bounce the panel closed. The pruneSelection effect below drops only the
    // ids an undo/redo step actually removed.
  }

  function redo() {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const next = h.future[0]
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
    })
  }

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const [saveError, setSaveError] = useState(false)
  const [loadCorrupted] = useState(initialLoad.corrupted)
  const [draftText, setDraftText] = useState('')
  const [draftFontId, setDraftFontId] = useState(AVAILABLE_FONTS[0].id)
  const [draftTextColor, setDraftTextColor] = useState(DMC_STARTER_COLORS[0])
  const [draftIconId, setDraftIconId] = useState(ICON_LIBRARY[0].id)
  const [draftIconColor, setDraftIconColor] = useState(DMC_STARTER_COLORS[0])
  const [draftMiniIconId, setDraftMiniIconId] = useState(MINI_ICON_LIBRARY[0].id)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [multiSelect, setMultiSelect] = useState(false)
  const [confirmingNewProject, setConfirmingNewProject] = useState(false)
  const [confirmingDeleteProject, setConfirmingDeleteProject] = useState(false)
  const [projectList, setProjectList] = useState(() => listProjects())
  const [activeTab, setActiveTab] = useState<ToolTab>('text')
  const isMobile = useIsMobile()
  const [drawMode, setDrawMode] = useState(false)
  const [stampMode, setStampMode] = useState(false)
  const [drawErase, setDrawErase] = useState(false)
  const [drawColor, setDrawColor] = useState(DMC_STARTER_COLORS[0])
  const [activePixelObjectId, setActivePixelObjectId] = useState<string | null>(null)
  const [widthInput, setWidthInput] = useState(() => String(project.widthStitches))
  const [heightInput, setHeightInput] = useState(() => String(project.heightStitches))
  const [spiInput, setSpiInput] = useState(() => String(project.fabric.stitchesPerInch))
  const [repeatCount, setRepeatCount] = useState(5)
  const [repeatSpacing, setRepeatSpacing] = useState(2)
  const [repeatDirection, setRepeatDirection] = useState<'horizontal' | 'vertical'>('horizontal')
  const selectedPanelRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLElement>(null)
  const canvasAreaRef = useRef<HTMLElement>(null)
  const isFirstProjectRender = useRef(true)

  const hasSelection = selectedIds.length > 0
  const [showBackupNudge, setShowBackupNudge] = useState(false)

  // Runs after every project change, whatever caused it (undo/redo, delete,
  // canvas-size clamp, project switch) — drops only the selected/active-draw
  // ids that no longer exist in the current project, so an edit that leaves
  // an object in place also leaves it selected instead of bouncing the panel
  // closed on every undo/redo step.
  useEffect(() => {
    setSelectedIds((ids) => {
      const filtered = ids.filter((id) => project.objects.some((o) => o.id === id))
      return filtered.length === ids.length ? ids : filtered
    })
    setActivePixelObjectId((id) => (id && !project.objects.some((o) => o.id === id) ? null : id))
  }, [project])

  useEffect(() => {
    setSaveError(!saveProject(project))
    setProjectList(listProjects())
    // The initial load isn't an edit — only count changes made in this session.
    if (isFirstProjectRender.current) {
      isFirstProjectRender.current = false
    } else {
      recordEdit()
      setShowBackupNudge(shouldShowBackupNudge())
    }
  }, [project])

  function dismissBackupNudge() {
    acknowledgeBackup()
    setShowBackupNudge(false)
  }

  // Selecting an object jumps the sidebar to the Selected panel (rendered at
  // the top) instead of leaving the user to scroll down and hunt for it —
  // reported as hard to find when the panel only ever appeared at the bottom.
  // Deliberately scrolls the .toolbar container directly (offsetTop math)
  // rather than calling scrollIntoView on the panel: scrollIntoView lets the
  // browser pick the nearest scrollable ancestor and its own alignment, which
  // on this layout landed the panel mid-scroll instead of pinned to the top —
  // not anchored to anything solid.
  useEffect(() => {
    const toolbar = toolbarRef.current
    const panel = selectedPanelRef.current
    if (!hasSelection || !toolbar || !panel) return
    // Desktop: .toolbar itself scrolls. Mobile (<=860px, matching the
    // breakpoint in App.css): .toolbar's overflow is set to visible and the
    // whole page scrolls instead — check the same breakpoint directly rather
    // than inferring it from a scrollHeight/clientHeight comparison, which
    // forces an extra synchronous layout read to rediscover what the CSS
    // breakpoint already tells us.
    if (!window.matchMedia('(max-width: 860px)').matches) {
      toolbar.scrollTo({ top: panel.offsetTop, behavior: 'smooth' })
    } else {
      // On mobile the canvas is position:sticky over the top of the page —
      // scrolling the panel's bare top under the viewport top hides its
      // header/name behind the sticky canvas. Clear that height first.
      const stickyHeight = canvasAreaRef.current?.offsetHeight ?? 0
      const top = panel.getBoundingClientRect().top + window.scrollY - stickyHeight
      window.scrollTo({ top, behavior: 'smooth' })
    }
    // Keyed on empty→non-empty, not every selection change — otherwise each tap in
    // Select-multiple mode would jump the mobile page away from the canvas.
  }, [hasSelection])

  useEffect(() => {
    setWidthInput(String(project.widthStitches))
    setHeightInput(String(project.heightStitches))
    setSpiInput(String(project.fabric.stitchesPerInch))
  }, [project.widthStitches, project.heightStitches, project.fabric.stitchesPerInch])

  useEffect(() => {
    const availableWidth = window.innerWidth - 24
    const fullWidthPx = project.widthStitches * CELL_SIZE
    // Deliberately fits to 60% of available width, not 100% — a canvas that exactly
    // fills the screen still feels "zoomed in" and pushes the toolbar below the fold
    // on mobile. Starting noticeably smaller than a tight fit leaves room to see the
    // tools without scrolling first (reported 2026-09-19: default felt too zoomed in).
    const fitZoom = Math.round((Math.min(1, (availableWidth * 0.6) / fullWidthPx) * 20)) / 20
    if (fitZoom < project.zoom) {
      updateZoomSilently((p) => ({ ...p, zoom: Math.max(MIN_ZOOM, fitZoom) }))
    }
    // run once on initial load only — a narrow screen should start zoomed to fit,
    // but shouldn't fight the user's own zoom choice on every resize afterward
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)
  const selectedObjects = project.objects.filter((o) => selectedIds.includes(o.id))
  // The full per-object panel only applies to a single object; multi-selections and
  // groups get the smaller move/duplicate/delete/group panel instead.
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null
  const selectionIsOneGroup =
    selectedObjects.length > 1 && selectedObjects.every((o) => o.groupId && o.groupId === selectedObjects[0].groupId)
  // Pixel drawings scale by adding/removing stitches, not a uniform NxN factor,
  // so color/size/rotation/repeat controls (all keyed off scale/color) don't apply.
  const selectedCanTransform = selectedObject !== null && selectedObject.kind !== 'pixels'

  function addTextObject() {
    if (!draftText.trim()) return
    const font = getFont(draftFontId)
    const { width, height } = measureText(draftText, font, 'horizontal', 1)
    const newObject: TextObject = {
      id: createId(),
      kind: 'text',
      content: draftText,
      font: draftFontId,
      direction: 'horizontal',
      scale: 1,
      x: Math.max(0, Math.floor((project.widthStitches - width) / 2)),
      y: Math.max(0, Math.floor((project.heightStitches - height) / 2)),
      rotation: 0,
      color: draftTextColor,
    }
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
    setDraftText('')
  }

  function addIconObject() {
    const icon = getIcon(draftIconId)
    const { width, height } = measureIcon(icon, 1)
    const newObject: IconObject = {
      id: createId(),
      kind: 'icon',
      iconId: draftIconId,
      scale: 1,
      x: Math.max(0, Math.floor((project.widthStitches - width) / 2)),
      y: Math.max(0, Math.floor((project.heightStitches - height) / 2)),
      rotation: 0,
      color: draftIconColor,
    }
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
  }

  function updateTextObject(patch: Partial<Omit<TextObject, 'id' | 'kind'>>, coalesceKey?: string) {
    if (!selectedObject) return
    setProject(
      (p) => ({
        ...p,
        objects: p.objects.map((o) =>
          o.id === selectedObject.id && o.kind === 'text'
            ? clampToCanvas({ ...o, ...patch }, p.widthStitches, p.heightStitches)
            : o,
        ),
        updatedAt: new Date().toISOString(),
      }),
      coalesceKey,
    )
  }

  function updateIconObject(patch: Partial<Omit<IconObject, 'id' | 'kind'>>) {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) =>
        o.id === selectedObject.id && o.kind === 'icon'
          ? clampToCanvas({ ...o, ...patch }, p.widthStitches, p.heightStitches)
          : o,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function deleteSelection() {
    setProject((p) => ({
      ...p,
      objects: p.objects.filter((o) => !selectedIds.includes(o.id)),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedIds([])
  }

  function duplicateSelection() {
    const bounds = selectionBounds(selectedObjects)
    if (!bounds) return
    const { dx, dy } = clampSelectionDelta(bounds, Math.max(bounds.width, 2), 0, project.widthStitches, project.heightStitches)
    const copies = cloneSelection(selectedObjects, dx, dy)
    setProject((p) => ({ ...p, objects: [...p.objects, ...copies], updatedAt: new Date().toISOString() }))
    setSelectedIds(copies.map((c) => c.id))
  }

  function groupSelection() {
    const groupId = createId()
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (selectedIds.includes(o.id) ? { ...o, groupId } : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  function ungroupSelection() {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (selectedIds.includes(o.id) ? { ...o, groupId: undefined } : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  // Repeats the selected object `count` times total (the original plus count-1
  // copies), spaced `spacing` stitches apart edge-to-edge — the "string of
  // hearts" border use case: pick a direction, a gap, and how many.
  function repeatSelectedObject(count: number, spacing: number, direction: 'horizontal' | 'vertical') {
    if (!selectedObject || selectedObject.kind === 'pixels') return
    const { width, height } = measureObject(selectedObject)
    const step = direction === 'horizontal' ? width + spacing : height + spacing
    const copies = Array.from({ length: Math.max(0, count - 1) }, (_, i) => {
      const n = i + 1
      const copy = {
        ...selectedObject,
        id: createId(),
        x: direction === 'horizontal' ? selectedObject.x + step * n : selectedObject.x,
        y: direction === 'vertical' ? selectedObject.y + step * n : selectedObject.y,
      }
      return clampToCanvas(copy, project.widthStitches, project.heightStitches)
    })
    setProject((p) => ({ ...p, objects: [...p.objects, ...copies], updatedAt: new Date().toISOString() }))
  }

  function moveSelection(ids: string[], dx: number, dy: number) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (ids.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  function resizeObject(id: string, patch: { scale: number; x: number; y: number }) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id && o.kind !== 'pixels' ? { ...o, ...patch } : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  function nudgeSelection(dx: number, dy: number) {
    const bounds = selectionBounds(selectedObjects)
    if (!bounds) return
    const clamped = clampSelectionDelta(bounds, dx, dy, project.widthStitches, project.heightStitches)
    if (clamped.dx === 0 && clamped.dy === 0) return
    moveSelection(selectedIds, clamped.dx, clamped.dy)
  }

  function setSelectedScale(scale: number) {
    if (!selectedObject) return
    const clampedScale = Math.min(MAX_OBJECT_SCALE, Math.max(1, scale))
    if (selectedObject.kind === 'text') {
      updateTextObject({ scale: clampedScale })
    } else if (selectedObject.kind === 'icon') {
      updateIconObject({ scale: clampedScale })
    }
  }

  // Keeps the object centered where it was — a 90° turn swaps width and height,
  // and x/y is the top-left of the rotated shape.
  function rotateSelectedObject(rotation: number) {
    if (!selectedObject || selectedObject.kind === 'pixels') return
    const before = measureObject(selectedObject)
    const after = measureObject({ ...selectedObject, rotation })
    const patch = {
      rotation,
      x: selectedObject.x + Math.floor((before.width - after.width) / 2),
      y: selectedObject.y + Math.floor((before.height - after.height) / 2),
    }
    if (selectedObject.kind === 'text') {
      updateTextObject(patch)
    } else {
      updateIconObject(patch)
    }
  }

  function alignSelectedObject(alignment: Alignment) {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) =>
        o.id === selectedObject.id ? alignObject(o, p.widthStitches, p.heightStitches, alignment) : o,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function reorderSelectedObject(kind: 'forward' | 'backward' | 'front' | 'back') {
    if (!selectedObject) return
    const id = selectedObject.id
    setProject((p) => {
      const idx = p.objects.findIndex((o) => o.id === id)
      if (idx === -1) return p
      const objects = [...p.objects]
      if (kind === 'forward' && idx < objects.length - 1) {
        ;[objects[idx], objects[idx + 1]] = [objects[idx + 1], objects[idx]]
      } else if (kind === 'backward' && idx > 0) {
        ;[objects[idx], objects[idx - 1]] = [objects[idx - 1], objects[idx]]
      } else if (kind === 'front' && idx < objects.length - 1) {
        const [obj] = objects.splice(idx, 1)
        objects.push(obj)
      } else if (kind === 'back' && idx > 0) {
        const [obj] = objects.splice(idx, 1)
        objects.unshift(obj)
      } else {
        return p
      }
      return { ...p, objects, updatedAt: new Date().toISOString() }
    })
  }

  function paintPixel(gx: number, gy: number) {
    const target = activePixelObjectId ? project.objects.find((o) => o.id === activePixelObjectId) : null
    if (target && target.kind === 'pixels') {
      const targetId = target.id
      setProject((p) => ({
        ...p,
        objects: p.objects.map((o) => (o.id === targetId && o.kind === 'pixels' ? paintCell(o, gx, gy, drawColor) : o)),
        updatedAt: new Date().toISOString(),
      }))
      return
    }
    const newObject = paintCell(createEmptyPixelObject(), gx, gy, drawColor)
    setActivePixelObjectId(newObject.id)
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
  }

  // Erases from the topmost drawing that has a stitch here — any drawing, not just
  // the one from the current session. A drawing erased down to nothing is removed.
  function erasePixel(gx: number, gy: number) {
    const target = [...project.objects]
      .reverse()
      .find((o) => o.kind === 'pixels' && o.cells.some((c) => o.x + c.dx === gx && o.y + c.dy === gy))
    if (!target) return
    setProject((p) => ({
      ...p,
      objects: p.objects
        .map((o) => (o.id === target.id && o.kind === 'pixels' ? eraseCell(o, gx, gy) : o))
        .filter((o) => o.kind !== 'pixels' || o.cells.length > 0),
      updatedAt: new Date().toISOString(),
    }))
  }

  function toggleDrawMode() {
    setDrawMode((wasOn) => {
      if (wasOn) setActivePixelObjectId(null)
      return !wasOn
    })
    setStampMode(false)
    setMultiSelect(false)
    setSelectedIds([])
  }

  function toggleStampMode() {
    setStampMode((wasOn) => !wasOn)
    setDrawMode(false)
    setActivePixelObjectId(null)
    setMultiSelect(false)
    setSelectedIds([])
  }

  function toggleMultiSelect() {
    setMultiSelect((wasOn) => !wasOn)
    setDrawMode(false)
    setStampMode(false)
    setActivePixelObjectId(null)
  }

  // Stamps a new tiny decoration icon at the tapped grid position — brush
  // style, for scattering small accents around a pattern without re-clicking
  // "Add icon" and re-dragging each time. Uses MINI_ICON_LIBRARY (3-5 stitches),
  // not the main icon library (7-9 stitches) — full-size icons scattered as
  // decoration read as cluttered, not decorative.
  function addIconObjectAt(gx: number, gy: number) {
    const newObject: IconObject = {
      id: createId(),
      kind: 'icon',
      iconId: draftMiniIconId,
      scale: 1,
      x: gx,
      y: gy,
      rotation: 0,
      color: draftIconColor,
    }
    setProject((p) => ({
      ...p,
      objects: [...p.objects, clampToCanvas(newObject, p.widthStitches, p.heightStitches)],
      updatedAt: new Date().toISOString(),
    }))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement
      const isTyping =
        active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement
      if (isTyping) return

      // Undo/redo work with no selection required, unlike the nudge shortcuts below —
      // checked first so they aren't gated behind hasSelection.
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (!hasSelection) return
      const step = e.shiftKey ? 5 : 1
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          nudgeSelection(-step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudgeSelection(step, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          nudgeSelection(0, -step)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudgeSelection(0, step)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection, selectedObjects])

  // Only one project exists and there's no undo, so replacing a non-empty design
  // asks first — inline, not a browser dialog.
  function requestNewProject() {
    if (project.objects.length === 0) {
      startNewProject()
    } else {
      setConfirmingNewProject(true)
    }
  }

  // Shared by everything that replaces the whole project wholesale (new/switch/
  // save-as) — otherwise each call site risks forgetting one of these resets,
  // like the width/height/SPI inputs silently keeping the old project's values.
  function swapProject(next: Project) {
    resetHistory(next)
    setSelectedIds([])
    setActivePixelObjectId(null)
    setConfirmingNewProject(false)
    setConfirmingDeleteProject(false)
    setDrawMode(false)
    setStampMode(false)
    setMultiSelect(false)
    setWidthInput(String(next.widthStitches))
    setHeightInput(String(next.heightStitches))
    setSpiInput(String(next.fabric.stitchesPerInch))
  }

  function startNewProject() {
    swapProject({ ...createEmptyProject('Untitled'), zoom: project.zoom })
  }

  // "Save as": copies the current design into a new slot under a new name and
  // switches to editing that copy, leaving the original untouched — the
  // variants-for-a-second-recipient workflow from docs/features.md.
  function saveProjectAs() {
    const name = window.prompt('Save a copy as:', `${project.name} copy`)
    if (!name) return
    const copy = duplicateProject(project, name)
    setProjectList(listProjects())
    swapProject(copy)
  }

  function switchProject(id: string) {
    if (id === project.id) return
    const target = projectList.find((p) => p.id === id)
    if (!target) return
    setActiveProject(id)
    swapProject(target)
  }

  function deleteCurrentProject() {
    const remaining = projectList.filter((p) => p.id !== project.id)
    deleteProject(project.id)
    setConfirmingDeleteProject(false)
    if (remaining.length > 0) {
      setActiveProject(remaining[0].id)
      swapProject(remaining[0])
    } else {
      swapProject(createEmptyProject('Untitled'))
    }
  }

  function setZoom(zoom: number) {
    updateZoomSilently((p) => ({ ...p, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }))
  }

  function setCanvasSize(widthStitches: number, heightStitches: number) {
    const w = Math.max(1, Math.min(500, Math.round(widthStitches) || 1))
    const h = Math.max(1, Math.min(500, Math.round(heightStitches) || 1))
    setProject((p) => ({
      ...p,
      widthStitches: w,
      heightStitches: h,
      // shrinking the canvas can leave existing objects hanging off the new edge —
      // pull them back in bounds rather than letting them silently clip/overflow
      objects: p.objects.map((o) => clampToCanvas(o, w, h)),
      updatedAt: new Date().toISOString(),
    }))
    setWidthInput(String(w))
    setHeightInput(String(h))
  }

  function setStitchesPerInch(stitchesPerInch: number) {
    const spi = Math.max(1, Math.min(30, Math.round(stitchesPerInch) || 1))
    setProject((p) => ({ ...p, fabric: { ...p.fabric, stitchesPerInch: spi } }))
    setSpiInput(String(spi))
  }

  // Width/height/stitches-per-inch inputs keep their own uncommitted text while
  // typing — committing (and clamping to >= 1) on every keystroke meant clearing
  // the field to type a fresh number immediately snapped back to "1" before the
  // next digit could land, making it impossible to type anything under 10.
  // Committing on blur/Enter instead lets the field sit empty mid-edit.
  function commitWidthInput() {
    const n = Number(widthInput)
    if (Number.isFinite(n) && n >= 1) {
      setCanvasSize(n, project.heightStitches)
    } else {
      setWidthInput(String(project.widthStitches))
    }
  }

  function commitHeightInput() {
    const n = Number(heightInput)
    if (Number.isFinite(n) && n >= 1) {
      setCanvasSize(project.widthStitches, n)
    } else {
      setHeightInput(String(project.heightStitches))
    }
  }

  function commitSpiInput() {
    const n = Number(spiInput)
    if (Number.isFinite(n) && n >= 1) {
      setStitchesPerInch(n)
    } else {
      setSpiInput(String(project.fabric.stitchesPerInch))
    }
  }

  const paletteColors = [
    ...new Map(
      project.objects.flatMap((o) => (o.kind === 'pixels' ? o.cells.map((c) => c.color) : [o.color])).map((c) => [c.dmcCode, c]),
    ).values(),
  ]

  const symbols = useMemo(() => assignSymbols(summarizeColors(flattenProject(project))), [project])
  const [showSymbols, setShowSymbols] = useState(true)

  const canvasBody = (
    <>
      <div className="size-input-row">
        <label>
          W
          <input
            type="number"
            min={1}
            max={500}
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            onBlur={commitWidthInput}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <label>
          H
          <input
            type="number"
            min={1}
            max={500}
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            onBlur={commitHeightInput}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>
      <label className="field-label">Fabric count (stitches/inch)</label>
      <input
        type="number"
        min={1}
        max={30}
        value={spiInput}
        onChange={(e) => setSpiInput(e.target.value)}
        onBlur={commitSpiInput}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </>
  )
  const draftFont = getFont(draftFontId)
  const draftUnsupported = unsupportedChars(draftText, draftFont)
  const draftSize = measureText(draftText, draftFont, 'horizontal', 1)
  const textBody = (
    <>
      <input
        type="text"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        placeholder="Type a phrase"
      />
      {draftUnsupported.length > 0 && (
        <p className="text-warning">
          {draftUnsupported.map((c) => `"${c}"`).join(', ')} {draftUnsupported.length === 1 ? "isn't" : "aren't"}{' '}
          supported yet and will be skipped.
        </p>
      )}
      {draftText && (
        <p className="tool-placeholder">
          {draftSize.width}×{draftSize.height} stitches at 1×
        </p>
      )}
      <select value={draftFontId} onChange={(e) => setDraftFontId(e.target.value)}>
        {AVAILABLE_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <ColorSwatchPicker selected={draftTextColor} onSelect={setDraftTextColor} />
      <button type="button" className="primary-btn" onClick={addTextObject}>
        Add text
      </button>
    </>
  )
  const iconsBody = (
    <>
      <div className="icon-grid">
        {ICON_LIBRARY.map((icon) => (
          <button
            key={icon.id}
            type="button"
            className={`icon-thumb-btn${draftIconId === icon.id ? ' icon-thumb-btn--active' : ''}`}
            title={icon.name}
            onClick={() => setDraftIconId(icon.id)}
          >
            <IconThumb icon={icon} color="#ddd" />
          </button>
        ))}
      </div>
      <ColorSwatchPicker selected={draftIconColor} onSelect={setDraftIconColor} />
      <button type="button" className="primary-btn" onClick={addIconObject}>
        Add icon
      </button>
    </>
  )
  const stampBody = (
    <>
      <div className="icon-grid">
        {MINI_ICON_LIBRARY.map((icon) => (
          <button
            key={icon.id}
            type="button"
            className={`icon-thumb-btn${draftMiniIconId === icon.id ? ' icon-thumb-btn--active' : ''}`}
            title={icon.name}
            onClick={() => setDraftMiniIconId(icon.id)}
          >
            <IconThumb icon={icon} color="#ddd" pixelSize={6} />
          </button>
        ))}
      </div>
      <button type="button" className={stampMode ? 'toggle-btn--active' : ''} onClick={toggleStampMode}>
        {stampMode ? 'Done stamping' : 'Stamp mode'}
      </button>
    </>
  )
  const drawBody = (
    <>
      <div className="button-row">
        <button
          type="button"
          className={`toggle-btn${!drawErase ? ' toggle-btn--active' : ''}`}
          onClick={() => setDrawErase(false)}
        >
          Paint
        </button>
        <button
          type="button"
          className={`toggle-btn${drawErase ? ' toggle-btn--active' : ''}`}
          onClick={() => setDrawErase(true)}
        >
          Erase
        </button>
      </div>
      {!drawErase && <ColorSwatchPicker selected={drawColor} onSelect={setDrawColor} />}
      <button
        type="button"
        className={drawMode ? 'toggle-btn--active' : ''}
        onClick={toggleDrawMode}
      >
        {drawMode ? 'Done drawing' : 'Start drawing'}
      </button>
    </>
  )

  const toolSections: { key: ToolTab; tab: string; title: string; body: React.ReactNode; defaultOpen: boolean }[] = [
    { key: 'text', tab: 'Text', title: 'Text', body: textBody, defaultOpen: true },
    { key: 'icons', tab: 'Icons', title: 'Icons', body: iconsBody, defaultOpen: true },
    { key: 'stamp', tab: 'Stamp', title: 'Stamp (tiny decorations)', body: stampBody, defaultOpen: false },
    { key: 'draw', tab: 'Draw', title: 'Draw', body: drawBody, defaultOpen: false },
    { key: 'canvas', tab: 'Canvas', title: 'Canvas Size', body: canvasBody, defaultOpen: false },
  ]

  const dpad = (
    <div className="dpad">
      <span />
      <button type="button" className="dpad-btn" onClick={() => nudgeSelection(0, -1)}>
        ↑
      </button>
      <span />
      <button type="button" className="dpad-btn" onClick={() => nudgeSelection(-1, 0)}>
        ←
      </button>
      <span className="dpad-center" />
      <button type="button" className="dpad-btn" onClick={() => nudgeSelection(1, 0)}>
        →
      </button>
      <span />
      <button type="button" className="dpad-btn" onClick={() => nudgeSelection(0, 1)}>
        ↓
      </button>
      <span />
    </div>
  )

  return (
    <div className="app-shell">
      <aside className="toolbar" ref={toolbarRef}>
        <h2>Tools</h2>
        {projectList.length > 1 && (
          <div className="tool-section project-switcher">
            <label htmlFor="project-select">Design</label>
            <select id="project-select" value={project.id} onChange={(e) => switchProject(e.target.value)}>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="button-row">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
            Redo
          </button>
        </div>
        <div className="button-row">
          <button type="button" onClick={requestNewProject}>
            New project
          </button>
          <button type="button" onClick={saveProjectAs}>
            Save as…
          </button>
          <button
            type="button"
            onClick={() => {
              const title = window.prompt('PDF Title:', project.name || '')
              if (title !== null) {
                exportProjectToPdf(project, title || undefined)
                acknowledgeBackup()
                setShowBackupNudge(false)
              }
            }}
          >
            Export PDF
          </button>
          <button type="button" className={multiSelect ? 'toggle-btn--active' : ''} onClick={toggleMultiSelect}>
            {multiSelect ? 'Done selecting' : 'Select multiple'}
          </button>
        </div>
        {projectList.length > 1 && (
          <div className="button-row">
            <button type="button" className="danger-btn" onClick={() => setConfirmingDeleteProject(true)}>
              Delete this design
            </button>
          </div>
        )}
        {confirmingDeleteProject && (
          <div className="confirm-bar">
            <p>Delete "{project.name}"? This can't be undone.</p>
            <div className="button-row">
              <button type="button" className="danger-btn" onClick={deleteCurrentProject}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirmingDeleteProject(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
        {confirmingNewProject && (
          <div className="confirm-bar">
            <p>Start over? Your current design will be deleted — this can't be undone.</p>
            <div className="button-row">
              <button type="button" className="danger-btn" onClick={startNewProject}>
                Delete and start new
              </button>
              <button type="button" onClick={() => setConfirmingNewProject(false)}>
                Keep editing
              </button>
            </div>
          </div>
        )}

        {selectedObject && (
          <div className="tool-section selected-panel" ref={selectedPanelRef}>
            <div className="selected-panel__header">
              <h3>Selected {selectedObject.kind === 'pixels' ? 'drawing' : selectedObject.kind}</h3>
              <div className="button-row">
                <button type="button" onClick={duplicateSelection}>
                  Duplicate
                </button>
                <button type="button" className="danger-btn" onClick={deleteSelection}>
                  Delete
                </button>
              </div>
            </div>
            <p className="selected-panel__label">
              {selectedObject.kind === 'text'
                ? `"${selectedObject.content}"`
                : selectedObject.kind === 'icon'
                  ? getIcon(selectedObject.iconId).name
                  : `${selectedObject.cells.length}-stitch drawing`}
            </p>

            {selectedObject.kind === 'text' && (
              <>
                <label className="field-label">Text</label>
                <input
                  type="text"
                  value={selectedObject.content}
                  onChange={(e) =>
                    updateTextObject({ content: e.target.value }, `text-content-${selectedObject.id}`)
                  }
                  placeholder="Edit text..."
                />
                {(() => {
                  const font = getFont(selectedObject.font)
                  const unsupported = unsupportedChars(selectedObject.content, font)
                  const size = measureText(selectedObject.content, font, selectedObject.direction, selectedObject.scale)
                  return (
                    <>
                      {unsupported.length > 0 && (
                        <p className="text-warning">
                          {unsupported.map((c) => `"${c}"`).join(', ')} {unsupported.length === 1 ? "isn't" : "aren't"}{' '}
                          supported yet and will be skipped.
                        </p>
                      )}
                      <p className="tool-placeholder">
                        {size.width}×{size.height} stitches
                        {(size.width > project.widthStitches || size.height > project.heightStitches) &&
                          ' — larger than the canvas'}
                      </p>
                    </>
                  )
                })()}

                <label className="field-label">Direction</label>
                <div className="button-row">
                  {(['horizontal', 'vertical'] as TextDirection[]).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className={`toggle-btn${selectedObject.direction === dir ? ' toggle-btn--active' : ''}`}
                      onClick={() => updateTextObject({ direction: dir })}
                    >
                      {dir === 'horizontal' ? 'Across' : 'Down'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedCanTransform && (
              <>
                <label className="field-label">Color</label>
                <ColorSwatchPicker
                  selected={selectedObject.color}
                  onSelect={(c) =>
                    selectedObject.kind === 'text' ? updateTextObject({ color: c }) : updateIconObject({ color: c })
                  }
                />
              </>
            )}

            <div className="move-size-row">
              <div>
                <label className="field-label">Position</label>
                {dpad}
              </div>
              {selectedCanTransform && (
                <div>
                  <label className="field-label">Size</label>
                  <div className="stepper-row">
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={selectedObject.scale <= 1}
                      onClick={() => setSelectedScale(selectedObject.scale - 1)}
                    >
                      −
                    </button>
                    <span className="stepper-value">{selectedObject.scale}×</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={selectedObject.scale >= MAX_OBJECT_SCALE}
                      onClick={() => setSelectedScale(selectedObject.scale + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Everything below here is arrange/duplicate-pattern tooling used far
                less often than editing content/color/position/size above — grouped
                into a collapsed sub-section instead of competing for the same
                always-visible space (Repeat in particular was flagged as not
                important enough to justify the panel jumping the whole view to it). */}
            <details className="selected-subsection">
              <summary>Rotate &amp; align</summary>
              {selectedCanTransform && (
                <>
                  <label className="field-label">Rotation</label>
                  <div className="button-row">
                    {[0, 90, 180, 270].map((angle) => (
                      <button
                        key={angle}
                        type="button"
                        className={`toggle-btn${selectedObject.rotation === angle ? ' toggle-btn--active' : ''}`}
                        onClick={() => rotateSelectedObject(angle)}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label className="field-label">Align</label>
              <div className="button-row">
                <button type="button" onClick={() => alignSelectedObject('left')}>
                  Left
                </button>
                <button type="button" onClick={() => alignSelectedObject('center-h')}>
                  Center
                </button>
                <button type="button" onClick={() => alignSelectedObject('right')}>
                  Right
                </button>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => alignSelectedObject('top')}>
                  Top
                </button>
                <button type="button" onClick={() => alignSelectedObject('center-v')}>
                  Middle
                </button>
                <button type="button" onClick={() => alignSelectedObject('bottom')}>
                  Bottom
                </button>
              </div>
              <label className="field-label">Layer</label>
              <div className="button-row">
                <button type="button" title="Send backward" onClick={() => reorderSelectedObject('backward')}>
                  ↓
                </button>
                <button type="button" title="Bring forward" onClick={() => reorderSelectedObject('forward')}>
                  ↑
                </button>
                <button type="button" title="Send to back" onClick={() => reorderSelectedObject('back')}>
                  To Back
                </button>
                <button type="button" title="Bring to front" onClick={() => reorderSelectedObject('front')}>
                  To Front
                </button>
              </div>
            </details>

            {selectedCanTransform && (
              <details className="selected-subsection">
                <summary>Repeat (border/string pattern)</summary>
                <div className="button-row">
                  <button
                    type="button"
                    className={`toggle-btn${repeatDirection === 'horizontal' ? ' toggle-btn--active' : ''}`}
                    onClick={() => setRepeatDirection('horizontal')}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn${repeatDirection === 'vertical' ? ' toggle-btn--active' : ''}`}
                    onClick={() => setRepeatDirection('vertical')}
                  >
                    ↓
                  </button>
                </div>
                <div className="size-input-row">
                  <label>
                    Count
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Math.max(2, Math.min(50, Number(e.target.value) || 2)))}
                    />
                  </label>
                  <label>
                    Gap
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={repeatSpacing}
                      onChange={(e) => setRepeatSpacing(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => repeatSelectedObject(repeatCount, repeatSpacing, repeatDirection)}
                >
                  Repeat
                </button>
              </details>
            )}
          </div>
        )}

        {selectedObjects.length > 1 && (
          <div className="tool-section selected-panel" ref={selectedPanelRef}>
            <div className="selected-panel__header">
              <h3>{selectionIsOneGroup ? 'Selected group' : `${selectedObjects.length} selected`}</h3>
              <div className="button-row">
                <button type="button" onClick={duplicateSelection}>
                  Duplicate
                </button>
                <button type="button" className="danger-btn" onClick={deleteSelection}>
                  Delete
                </button>
              </div>
            </div>
            <p className="selected-panel__label">
              {selectedObjects.length} objects{selectionIsOneGroup ? ' · grouped' : ''}
            </p>

            <label className="field-label">Position</label>
            {dpad}

            <div className="button-row">
              {selectionIsOneGroup ? (
                <button type="button" onClick={ungroupSelection}>
                  Ungroup
                </button>
              ) : (
                <button type="button" onClick={groupSelection}>
                  Group
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile shows one tool at a time via the tab strip under the sticky canvas
            (and hides it entirely while something is selected, so the Selected panel
            sits right under the canvas). Desktop keeps every tool as a collapsible card. */}
        {isMobile
          ? !hasSelection && (
              <div className="tool-section">{toolSections.find((t) => t.key === activeTab)?.body}</div>
            )
          : toolSections.map((t) => (
              <details key={t.key} className="tool-section" open={t.defaultOpen}>
                <summary>{t.title}</summary>
                {t.body}
              </details>
            ))}
      </aside>

      <main className="canvas-area" ref={canvasAreaRef}>
        {saveError && (
          <p className="save-banner save-banner--error">
            Couldn't save — your browser's storage may be full. Recent changes may be lost.
          </p>
        )}
        {loadCorrupted && (
          <p className="save-banner save-banner--warning">
            Your last saved project couldn't be read and had to be reset. Starting a new one.
          </p>
        )}
        {showBackupNudge && (
          <p className="save-banner save-banner--info">
            Your design only lives in this browser. Consider exporting a PDF as a backup.{' '}
            <button type="button" className="save-banner__dismiss" onClick={dismissBackupNudge}>
              Dismiss
            </button>
          </p>
        )}
        <div className="canvas-meta">
          <span>
            {project.widthStitches}×{project.heightStitches} stitches · {inchesWidth}"×{inchesHeight}"
            <span className="canvas-meta__extra"> at {project.fabric.stitchesPerInch} stitches/inch</span>
          </span>
          <span className="zoom-controls">
            <button type="button" className="symbols-toggle" aria-pressed={showSymbols} onClick={() => setShowSymbols((v) => !v)}>
              Symbols {showSymbols ? 'on' : 'off'}
            </button>
            <button type="button" onClick={() => setZoom(project.zoom - 0.25)} disabled={project.zoom <= MIN_ZOOM}>
              −
            </button>
            {Math.round(project.zoom * 100)}%
            <button type="button" onClick={() => setZoom(project.zoom + 0.25)} disabled={project.zoom >= MAX_ZOOM}>
              +
            </button>
          </span>
        </div>
        {(drawMode || stampMode || multiSelect) && (
          <div className="mode-chip">
            <span>
              {drawMode
                ? `Drawing — tap cells to ${drawErase ? 'erase' : 'paint'}`
                : stampMode
                  ? 'Stamping — tap to drop decorations'
                  : 'Selecting multiple — tap objects to add/remove'}
            </span>
            <button
              type="button"
              onClick={drawMode ? toggleDrawMode : stampMode ? toggleStampMode : toggleMultiSelect}
            >
              Done
            </button>
          </div>
        )}
        <div className="canvas-scroll">
          <CanvasGrid
            widthStitches={project.widthStitches}
            heightStitches={project.heightStitches}
            zoom={project.zoom}
            objects={project.objects}
            selectedIds={selectedIds}
            multiSelect={multiSelect}
            onSelectionChange={setSelectedIds}
            onMoveSelection={moveSelection}
            onResize={resizeObject}
            drawMode={drawMode}
            drawErase={drawErase}
            onPaintCell={paintPixel}
            onEraseCell={erasePixel}
            stampMode={stampMode}
            onStamp={addIconObjectAt}
            symbols={symbols}
            showSymbols={showSymbols}
          />
        </div>
        {isMobile && (
          <nav className="tool-tabs">
            {toolSections.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tool-tab${!hasSelection && activeTab === t.key ? ' tool-tab--active' : ''}`}
                onClick={() => {
                  setActiveTab(t.key)
                  setSelectedIds([])
                }}
              >
                {t.tab}
              </button>
            ))}
          </nav>
        )}
      </main>

      <aside className="palette-panel">
        <h2>Palette</h2>
        {paletteColors.length === 0 ? (
          <p className="tool-placeholder">DMC colors used in this design will list here.</p>
        ) : (
          <ul className="palette-list">
            {paletteColors.map((c) => (
              <li key={c.dmcCode}>
                <span className="swatch" style={{ backgroundColor: c.hex, color: symbolTextIsBlack(c.hex) ? '#000' : '#fff' }}>
                  {symbols.get(c.dmcCode)}
                </span>
                DMC {c.dmcCode} · {c.name}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

export default App
