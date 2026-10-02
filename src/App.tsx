import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasGrid, CELL_SIZE } from './components/CanvasGrid'
import { ColorSwatchPicker } from './components/ColorSwatchPicker'
import { BorderThumb } from './components/BorderThumb'
import { IconThumb } from './components/IconThumb'
import { createEmptyProject, type BorderMargins, type BorderMetadata, type BorderSides, type CanvasObject, type IconObject, type PixelObject, type Project, type StitchColor, type TextDirection, type TextObject } from './lib/types'
import { EXAMPLES } from './lib/examples'
import { duplicateProject, listProjects, loadProject, saveProject, setActiveProject, deleteProject } from './lib/storage'
import { AVAILABLE_FONTS, getFont } from './lib/fonts'
import type { BitmapFont } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { accentDroppedChars, measureText, unsupportedChars } from './lib/textRender'
import { ICON_GROUPS, ICON_LIBRARY, MINI_ICON_LIBRARY, getIcon, setCustomIcons, type IconDef } from './lib/icons'
import {
  CUSTOM_GROUP,
  iconToPixelObject,
  iconToSource,
  loadCustomIcons,
  pixelObjectToIcon,
  saveCustomIcons,
} from './lib/customIcons'
import { measureIcon } from './lib/iconRender'
import { displayRotation } from './lib/objectCells'
import { clampToCanvas, measureObject, MAX_OBJECT_SCALE } from './lib/objectMeasure'
import { createId } from './lib/id'
import { alignUnits, countUnits, distributeUnits, type Alignment, type DistributeAxis } from './lib/align'
import { splitTextObject } from './lib/splitText'
import { createEmptyPixelObject, eraseCells, paintCells, type GridCell } from './lib/pixelObject'
import { exportProjectToPdf } from './lib/exportPdf'
import { assignSymbols, symbolTextIsBlack } from './lib/chartLayout'
import { replaceColor } from './lib/recolor'
import { BORDERS, borderFits, borderHasAccent, buildBorder, defaultBorderColors, getBorder } from './lib/borders'
import { accentColorOf, byCode, iconHasAccent, iconPreviewColors, newIconColors, objectColors } from './lib/iconColors'
import { flattenProject, summarizeColors } from './lib/flattenProject'
import { acknowledgeBackup, recordEdit, shouldShowBackupNudge } from './lib/backupNudge'
import { clampSelectionDelta, cloneSelection, selectionBounds } from './lib/selection'
import { inkUnionBounds } from './lib/inkBounds'
import { mirrorObjects, type MirrorAxis } from './lib/mirror'
import { useIsMobile } from './useIsMobile'
import './App.css'

type ToolTab = 'text' | 'icons' | 'stamp' | 'draw' | 'canvas'

const ICON_EDITOR_KEY = 'cross-stitch-tool:icon-editor'
const SNAP_KEY = 'cross-stitch-tool:snap'
const initialCustomIcons = loadCustomIcons()
setCustomIcons(initialCustomIcons)

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5

type ProjectHistory = { past: Project[]; present: Project; future: Project[] }

const HISTORY_LIMIT = 50
// Rapid-fire edits to the same field (typing into the placed-text content box)
// coalesce into one undo step instead of one per keystroke — pass the same
// coalesceKey to setProject calls that should merge this way while they keep
// landing within this window of each other.
const COALESCE_WINDOW_MS = 800

function TextWarnings({ text, font }: { text: string; font: BitmapFont }) {
  const unsupported = unsupportedChars(text, font)
  const dropped = accentDroppedChars(text, font)
  const quote = (chars: string[]) => chars.map((c) => `"${c}"`).join(', ')
  return (
    <>
      {unsupported.length > 0 && (
        <p className="text-warning">
          {quote(unsupported)} {unsupported.length === 1 ? "isn't" : "aren't"} supported and will be skipped.
        </p>
      )}
      {dropped.length > 0 && (
        <p className="text-warning">
          {quote(dropped)} will print without {dropped.length === 1 ? 'its' : 'their'} accent in this font. Mixed case has accents.
        </p>
      )}
    </>
  )
}

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
  const [iconQuery, setIconQuery] = useState('')
  const [openIconGroup, setOpenIconGroup] = useState<string>(ICON_GROUPS[0].id)
  const [draftIconColor, setDraftIconColor] = useState(DMC_STARTER_COLORS[0])
  const [draftIconAccent, setDraftIconAccent] = useState(DMC_STARTER_COLORS[0])
  const [draftBorderId, setDraftBorderId] = useState(BORDERS[0].id)
  const [draftBorderColor, setDraftBorderColor] = useState(() => defaultBorderColors(BORDERS[0]).main)
  const [draftBorderAccent, setDraftBorderAccent] = useState(() => defaultBorderColors(BORDERS[0]).accent)
  const [borderMargin, setBorderMargin] = useState(1)
  const [draftBorderMargins, setDraftBorderMargins] = useState<BorderMargins>({ top: 1, bottom: 1, left: 1, right: 1 })
  const [independentBorderMargins, setIndependentBorderMargins] = useState(false)
  const [draftBorderSides, setDraftBorderSides] = useState<BorderSides>({ top: true, bottom: true, left: true, right: true })
  const [draftMiniIconId, setDraftMiniIconId] = useState(MINI_ICON_LIBRARY[0].id)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [multiSelect, setMultiSelect] = useState(false)
  const [alignTarget, setAlignTarget] = useState<string>('selection')
  const [alignMargin, setAlignMargin] = useState(0)
  const [snapEnabled, setSnapEnabled] = useState(() => {
    try {
      return localStorage.getItem(SNAP_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const [confirmingNewProject, setConfirmingNewProject] = useState(false)
  const [confirmingDeleteProject, setConfirmingDeleteProject] = useState(false)
  const [projectList, setProjectList] = useState(() => listProjects())
  const [activeTab, setActiveTab] = useState<ToolTab>('text')
  const isMobile = useIsMobile()
  const [drawMode, setDrawMode] = useState(false)
  const [iconEditorOn, setIconEditorOn] = useState(() => {
    try {
      return localStorage.getItem(ICON_EDITOR_KEY) === '1'
    } catch {
      return false
    }
  })
  const [customIcons, setCustomIconList] = useState(initialCustomIcons)
  const [iconSaveName, setIconSaveName] = useState('')
  const [iconSaveError, setIconSaveError] = useState('')
  const [savedIcon, setSavedIcon] = useState<IconDef | null>(null)
  const [snippetGroup, setSnippetGroup] = useState('more')
  const [confirmingDeleteIcon, setConfirmingDeleteIcon] = useState(false)
  const [stampMode, setStampMode] = useState(false)
  const [drawErase, setDrawErase] = useState(false)
  const [drawShape, setDrawShape] = useState<'free' | 'line' | 'rect' | 'fill'>('free')
  const [drawBrushSize, setDrawBrushSize] = useState<number>(1)
  const [drawColor, setDrawColor] = useState(DMC_STARTER_COLORS[0])
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [activePixelObjectId, setActivePixelObjectIdState] = useState<string | null>(null)
  const activePixelRef = useRef<string | null>(null)
  function setActivePixelObjectId(id: string | null) {
    activePixelRef.current = id
    setActivePixelObjectIdState(id)
  }
  const [widthInput, setWidthInput] = useState(() => String(project.widthStitches))
  const [heightInput, setHeightInput] = useState(() => String(project.heightStitches))
  const [spiInput, setSpiInput] = useState(() => String(project.fabric.stitchesPerInch))
  const [repeatCount, setRepeatCount] = useState('5')
  const [repeatSpacing, setRepeatSpacing] = useState('2')
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
    const active = activePixelRef.current
    if (active && !project.objects.some((o) => o.id === active)) setActivePixelObjectId(null)
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
  const selectedBorder =
    selectedObject?.kind === 'pixels' && selectedObject.borderMeta
      ? (selectedObject as PixelObject & { borderMeta: BorderMetadata })
      : null
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
    setStampMode(false)
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
    setDraftText('')
  }

  function selectDraftIcon(icon: IconDef) {
    const colors = newIconColors(icon, draftIconColor)
    setDraftIconId(icon.id)
    setDraftIconColor(colors.color)
    if (colors.color2) setDraftIconAccent(colors.color2)
  }

  function addIconObject(targetIcon?: IconDef) {
    const icon = targetIcon ?? getIcon(draftIconId)
    const { width, height } = measureIcon(icon, 1)
    const preview = iconPreviewColors(icon)
    const mainCol = targetIcon ? byCode(preview.color) : draftIconColor
    const accentCol = targetIcon ? byCode(preview.accent) : draftIconAccent
    const newObject: IconObject = {
      id: createId(),
      kind: 'icon',
      iconId: icon.id,
      scale: 1,
      x: Math.max(0, Math.floor((project.widthStitches - width) / 2)),
      y: Math.max(0, Math.floor((project.heightStitches - height) / 2)),
      rotation: 0,
      color: mainCol,
      ...(iconHasAccent(icon) ? { color2: accentCol } : {}),
    }
    setStampMode(false)
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
    setSelectedIds([newObject.id])
  }

  function toggleIconEditor() {
    const next = !iconEditorOn
    setIconEditorOn(next)
    try {
      localStorage.setItem(ICON_EDITOR_KEY, next ? '1' : '0')
    } catch {
      // storage unavailable; the toggle just won't persist
    }
  }

  function updateCustomIcons(next: IconDef[]) {
    setCustomIcons(next)
    saveCustomIcons(next)
    setCustomIconList(next)
  }

  function editIconAsDrawing() {
    const icon = getIcon(draftIconId)
    const drawing = iconToPixelObject(icon, draftIconColor, draftIconAccent, project.widthStitches, project.heightStitches)
    setProject((p) => ({ ...p, objects: [...p.objects, drawing], updatedAt: new Date().toISOString() }))
    setIconSaveName(icon.name)
    setIconSaveError('')
    setSavedIcon(null)
    setStampMode(false)
    setMultiSelect(false)
    setSelectedIds([])
    setDrawErase(false)
    setDrawMode(true)
    setActivePixelObjectId(drawing.id)
    setActiveTab('draw')
  }

  function saveIconFromDrawing() {
    const drawing = project.objects.find((o) => o.id === iconSaveTargetId)
    if (!drawing || drawing.kind !== 'pixels') return
    const result = pixelObjectToIcon(drawing, iconSaveName)
    if (!result.ok) {
      setIconSaveError(result.error)
      return
    }
    setIconSaveError('')
    updateCustomIcons([...customIcons.filter((i) => i.id !== result.icon.id), result.icon])
    setSavedIcon(result.icon)
    selectDraftIcon(result.icon)
    setOpenIconGroup(CUSTOM_GROUP)
  }

  function deleteCustomIcon() {
    updateCustomIcons(customIcons.filter((i) => i.id !== draftIconId))
    setDraftIconId(ICON_LIBRARY[0].id)
    setConfirmingDeleteIcon(false)
  }

  function isAllSides(s: BorderSides) {
    return s.top && s.bottom && s.left && s.right
  }
  function isTopBottomSides(s: BorderSides) {
    return s.top && s.bottom && !s.left && !s.right
  }
  function isLeftRightSides(s: BorderSides) {
    return !s.top && !s.bottom && s.left && s.right
  }

  function selectDraftBorder(id: string) {
    const def = getBorder(id)
    const colors = defaultBorderColors(def)
    setDraftBorderId(id)
    setDraftBorderColor(colors.main)
    setDraftBorderAccent(colors.accent)
    if (selectedObject?.kind === 'pixels' && selectedObject.borderMeta) {
      updateBorderObject({ borderId: id, mainColor: colors.main, accentColor: colors.accent })
    }
  }

  function updateBorderObject(updates: Partial<BorderMetadata>) {
    if (!selectedObject || selectedObject.kind !== 'pixels' || !selectedObject.borderMeta) return
    const currentMeta = selectedObject.borderMeta
    const newMeta: BorderMetadata = {
      ...currentMeta,
      ...updates,
      margins: updates.margins ? { ...currentMeta.margins, ...updates.margins } : currentMeta.margins,
      sides: updates.sides ? { ...currentMeta.sides, ...updates.sides } : currentMeta.sides,
    }
    const def = getBorder(newMeta.borderId)
    const newBorder = buildBorder(
      def,
      project.widthStitches,
      project.heightStitches,
      newMeta.margins,
      newMeta.mainColor,
      newMeta.accentColor,
      newMeta.sides,
    )
    if (!newBorder) return

    setProject(
      (p) => ({
        ...p,
        objects: p.objects.map((o) =>
          o.id === selectedObject.id ? { ...newBorder, id: selectedObject.id, ...(o.groupId ? { groupId: o.groupId } : {}) } : o,
        ),
        updatedAt: new Date().toISOString(),
      }),
      `edit-border-${selectedObject.id}`,
    )
  }

  function setBorderMarginUniform(val: number) {
    const clamped = Math.max(0, val)
    updateBorderObject({
      margins: { top: clamped, bottom: clamped, left: clamped, right: clamped },
    })
  }

  function addBorder() {
    const def = getBorder(draftBorderId)
    const margins = independentBorderMargins ? draftBorderMargins : borderMargin
    const border = buildBorder(
      def,
      project.widthStitches,
      project.heightStitches,
      margins,
      draftBorderColor,
      draftBorderAccent,
      draftBorderSides,
    )
    if (!border) return
    setStampMode(false)
    setProject((p) => ({ ...p, objects: [...p.objects, border], updatedAt: new Date().toISOString() }))
    setSelectedIds([border.id])
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

  const clampRepeatCount = (v: string) => Math.max(2, Math.min(50, Math.round(Number(v)) || 2))
  const clampRepeatSpacing = (v: string) => Math.max(0, Math.min(50, Math.round(Number(v)) || 0))

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
    rotation = displayRotation(rotation, selectedObject.mirrorH, selectedObject.mirrorV)
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

  function applyMovedObjects(moved: CanvasObject[]) {
    const byId = new Map(moved.map((o) => [o.id, o]))
    setProject((p) => {
      const changed = p.objects.some((o) => {
        const m = byId.get(o.id)
        return m && (m.x !== o.x || m.y !== o.y)
      })
      if (!changed) return p
      return { ...p, objects: p.objects.map((o) => byId.get(o.id) ?? o), updatedAt: new Date().toISOString() }
    })
  }

  const selectionUnitCount = countUnits(selectedObjects)

  const alignTargets = (() => {
    const seenGroups = new Set<string>()
    const selected = new Set(selectedIds)
    const targets: { id: string; label: string; members: CanvasObject[] }[] = []
    for (const o of project.objects) {
      if (selected.has(o.id) || (o.kind === 'pixels' && o.hollow)) continue
      const members = o.groupId ? project.objects.filter((m) => m.groupId === o.groupId) : [o]
      if (members.some((m) => selected.has(m.id))) continue
      if (o.groupId) {
        if (seenGroups.has(o.groupId)) continue
        seenGroups.add(o.groupId)
      }
      const name = o.groupId ? `Group of ${members.length}` : o.kind === 'text' ? `"${o.content}"` : o.kind === 'icon' ? getIcon(o.iconId).name : 'Drawing'
      targets.push({ id: o.id, label: name, members })
    }
    return targets
  })()
  const alignTargetChoice = alignTarget === 'selection' && selectionUnitCount > 1 ? 'selection' : alignTargets.some((t) => t.id === alignTarget) ? alignTarget : 'canvas'

  function mirrorSelection(axis: MirrorAxis) {
    if (selectedObjects.length === 0) return
    const flipped = new Map(
      mirrorObjects(selectedObjects, axis, project.widthStitches, project.heightStitches).map((o) => [o.id, o]),
    )
    setProject((p) => ({ ...p, objects: p.objects.map((o) => flipped.get(o.id) ?? o), updatedAt: new Date().toISOString() }))
  }

  function toggleSnap() {
    const next = !snapEnabled
    setSnapEnabled(next)
    try {
      localStorage.setItem(SNAP_KEY, next ? 'on' : 'off')
    } catch {
      // storage unavailable; the toggle still works for this session
    }
  }

  function alignSelection(alignment: Alignment) {
    const margin = Math.max(0, Math.min(alignMargin, Math.floor((Math.min(project.widthStitches, project.heightStitches) - 1) / 2)))
    let reference = {
      x: margin,
      y: margin,
      width: project.widthStitches - 2 * margin,
      height: project.heightStitches - 2 * margin,
    }
    if (alignTargetChoice === 'selection') {
      reference = inkUnionBounds(selectedObjects)!
    } else if (alignTargetChoice !== 'canvas') {
      reference = inkUnionBounds(alignTargets.find((t) => t.id === alignTargetChoice)!.members)!
    }
    applyMovedObjects(alignUnits(selectedObjects, alignment, reference, project.widthStitches, project.heightStitches))
  }

  function distributeSelection(axis: DistributeAxis) {
    applyMovedObjects(distributeUnits(selectedObjects, axis))
  }

  function splitSelectedText() {
    if (!selectedObject || selectedObject.kind !== 'text') return
    const letters = splitTextObject(selectedObject)
    if (letters.length < 2) return
    const sourceId = selectedObject.id
    setProject((p) => {
      const idx = p.objects.findIndex((o) => o.id === sourceId)
      if (idx === -1) return p
      return { ...p, objects: [...p.objects.slice(0, idx), ...letters, ...p.objects.slice(idx + 1)], updatedAt: new Date().toISOString() }
    })
    setSelectedIds(letters.map((l) => l.id))
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

  // A stroke arrives as many batches with the same strokeId; they coalesce into one
  // undo step. The target drawing is resolved inside the updater against the latest
  // project, so batches landing before a re-render still hit the same drawing.
  function paintPixels(cells: GridCell[], strokeId: string) {
    const targetId = activePixelRef.current ?? createId()
    if (!activePixelRef.current) setActivePixelObjectId(targetId)
    setProject((p) => {
      const existing = p.objects.find((o) => o.id === targetId && o.kind === 'pixels')
      if (existing && existing.kind === 'pixels') {
        const painted = paintCells(existing, cells, drawColor)
        return { ...p, objects: p.objects.map((o) => (o === existing ? painted : o)), updatedAt: new Date().toISOString() }
      }
      const created = paintCells({ ...createEmptyPixelObject(), id: targetId }, cells, drawColor)
      return { ...p, objects: [...p.objects, created], updatedAt: new Date().toISOString() }
    }, `draw-stroke-${strokeId}`)
  }

  // Erases from the topmost drawing that has a stitch at each cell — any drawing, not
  // just the one from the current session. A drawing erased down to nothing is removed.
  function erasePixels(cells: GridCell[], strokeId: string) {
    setProject((p) => {
      let objects = p.objects
      for (const cell of cells) {
        const target = [...objects]
          .reverse()
          .find((o) => o.kind === 'pixels' && o.cells.some((c) => o.x + c.dx === cell.gx && o.y + c.dy === cell.gy))
        if (!target || target.kind !== 'pixels') continue
        const erased = eraseCells(target, [cell])
        objects = objects.map((o) => (o === target ? erased : o))
      }
      if (objects === p.objects) return p
      return { ...p, objects: objects.filter((o) => o.kind !== 'pixels' || o.cells.length > 0), updatedAt: new Date().toISOString() }
    }, `draw-stroke-${strokeId}`)
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

      if (e.key === 'Escape') {
        e.preventDefault()
        if (hasSelection) {
          setSelectedIds([])
        } else if (drawMode) {
          toggleDrawMode()
        } else if (stampMode) {
          setStampMode(false)
        } else if (eyedropperActive) {
          setEyedropperActive(false)
        }
        return
      }

      if (!hasSelection) return

      if ((e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        deleteSelection()
        return
      }

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
  }, [hasSelection, selectedObjects, selectedIds, drawMode, stampMode, eyedropperActive])

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
    setReplacingCode(null)
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

  function loadExample(id: string) {
    const example = EXAMPLES.find((e) => e.id === id)?.build(project.zoom)
    if (!example) return
    saveProject(example)
    setProjectList(listProjects())
    swapProject(example)
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
      project.objects.flatMap(objectColors).map((c) => [c.dmcCode, c]),
    ).values(),
  ]

  const symbols = useMemo(() => assignSymbols(summarizeColors(flattenProject(project))), [project])
  const [showSymbols, setShowSymbols] = useState(true)
  const [replacingCode, setReplacingCode] = useState<string | null>(null)

  function replaceEverywhere(fromCode: string, to: StitchColor) {
    setProject((p) => ({ ...p, objects: replaceColor(p.objects, fromCode, to), updatedAt: new Date().toISOString() }))
    setReplacingCode(null)
  }

  const draftBorderDef = getBorder(draftBorderId)
  const draftBorderHasAccent = borderHasAccent(draftBorderDef)
  const currentBorderMargins = independentBorderMargins ? draftBorderMargins : borderMargin
  const borderFitsCanvas = borderFits(
    draftBorderDef,
    project.widthStitches,
    project.heightStitches,
    currentBorderMargins,
    draftBorderSides,
  )
  const flipControls = (
    <>
      <label className="field-label">Flip</label>
      <div className="button-row">
        <button type="button" title="Mirror left to right" onClick={() => mirrorSelection('horizontal')}>
          Left ↔ Right
        </button>
        <button type="button" title="Mirror top to bottom" onClick={() => mirrorSelection('vertical')}>
          Top ↕ Bottom
        </button>
      </div>
    </>
  )

  const alignControls = (
    <>
      <label className="field-label">Align to</label>
      <select aria-label="Align to" value={alignTargetChoice} onChange={(e) => setAlignTarget(e.target.value)}>
        <option value="canvas">Canvas</option>
        {selectionUnitCount > 1 && <option value="selection">Selection</option>}
        {alignTargets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {alignTargetChoice === 'canvas' && (
        <label className="field-label">
          Margin (stitches){' '}
          <input
            type="number"
            min={0}
            max={20}
            value={alignMargin}
            onChange={(e) => setAlignMargin(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
          />
        </label>
      )}
      <div className="button-row">
        <button type="button" onClick={() => alignSelection('left')}>
          Left
        </button>
        <button type="button" onClick={() => alignSelection('center-h')}>
          Center
        </button>
        <button type="button" onClick={() => alignSelection('right')}>
          Right
        </button>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => alignSelection('top')}>
          Top
        </button>
        <button type="button" onClick={() => alignSelection('center-v')}>
          Middle
        </button>
        <button type="button" onClick={() => alignSelection('bottom')}>
          Bottom
        </button>
      </div>
    </>
  )

  const canvasPresets = [
    { label: '40×40', w: 40, h: 40 },
    { label: '60×60', w: 60, h: 60 },
    { label: '80×80', w: 80, h: 80 },
    { label: '4" hoop', w: Math.round(4 * project.fabric.stitchesPerInch), h: Math.round(4 * project.fabric.stitchesPerInch) },
    { label: '6" hoop', w: Math.round(6 * project.fabric.stitchesPerInch), h: Math.round(6 * project.fabric.stitchesPerInch) },
  ]

  const canvasBody = (
    <>
      <label className="field-label">Presets</label>
      <div className="button-row canvas-presets-row">
        {canvasPresets.map((preset) => {
          const isCurrent = project.widthStitches === preset.w && project.heightStitches === preset.h
          return (
            <button
              key={preset.label}
              type="button"
              className={`toggle-btn${isCurrent ? ' toggle-btn--active' : ''}`}
              onClick={() => setCanvasSize(preset.w, preset.h)}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <label className="field-label">Canvas size (stitches)</label>
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
      <div className="button-row canvas-nudge-row">
        <button
          type="button"
          onClick={() => setCanvasSize(project.widthStitches - 5, project.heightStitches - 5)}
          disabled={project.widthStitches <= 5 || project.heightStitches <= 5}
          title="Shrink canvas by 5 stitches on both dimensions"
        >
          −5 both
        </button>
        <button
          type="button"
          onClick={() => setCanvasSize(project.widthStitches + 5, project.heightStitches + 5)}
          title="Expand canvas by 5 stitches on both dimensions"
        >
          +5 both
        </button>
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
      <label className="field-label">Border</label>
      <div className="border-grid">
        {BORDERS.map((b) => {
          const active = draftBorderId === b.id
          const colors = defaultBorderColors(b)
          return (
            <button
              key={b.id}
              type="button"
              className={`border-thumb-btn${active ? ' border-thumb-btn--active' : ''}`}
              onClick={() => selectDraftBorder(b.id)}
            >
              <BorderThumb
                border={b}
                color={active ? draftBorderColor.hex : colors.main.hex}
                accentColor={active ? draftBorderAccent.hex : colors.accent.hex}
              />
              <span>{b.name}</span>
            </button>
          )
        })}
      </div>
      <label className="field-label">{draftBorderHasAccent ? 'Main color' : 'Color'}</label>
      <ColorSwatchPicker selected={draftBorderColor} onSelect={setDraftBorderColor} projectColors={paletteColors} />
      {draftBorderHasAccent && (
        <>
          <label className="field-label">Accent color</label>
          <ColorSwatchPicker selected={draftBorderAccent} onSelect={setDraftBorderAccent} projectColors={paletteColors} />
        </>
      )}
      <label className="field-label">Sides</label>
      <div className="button-row">
        <button
          type="button"
          className={`toggle-btn${isAllSides(draftBorderSides) ? ' toggle-btn--active' : ''}`}
          onClick={() => setDraftBorderSides({ top: true, bottom: true, left: true, right: true })}
        >
          All
        </button>
        <button
          type="button"
          className={`toggle-btn${isTopBottomSides(draftBorderSides) ? ' toggle-btn--active' : ''}`}
          onClick={() => setDraftBorderSides({ top: true, bottom: true, left: false, right: false })}
        >
          Top & Bottom
        </button>
        <button
          type="button"
          className={`toggle-btn${isLeftRightSides(draftBorderSides) ? ' toggle-btn--active' : ''}`}
          onClick={() => setDraftBorderSides({ top: false, bottom: false, left: true, right: true })}
        >
          Left & Right
        </button>
      </div>
      <div className="button-row">
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
          const active = draftBorderSides[side]
          return (
            <button
              key={side}
              type="button"
              className={`toggle-btn${active ? ' toggle-btn--active' : ''}`}
              onClick={() => setDraftBorderSides((s) => ({ ...s, [side]: !s[side] }))}
            >
              {side.charAt(0).toUpperCase() + side.slice(1)}
            </button>
          )
        })}
      </div>

      <label className="field-label">Distance from edge</label>
      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          disabled={borderMargin <= 0}
          onClick={() => {
            const m = borderMargin - 1
            setBorderMargin(m)
            setDraftBorderMargins({ top: m, bottom: m, left: m, right: m })
          }}
        >
          −
        </button>
        <span className="stepper-value">{borderMargin} stitches</span>
        <button
          type="button"
          className="stepper-btn"
          disabled={borderMargin >= 15}
          onClick={() => {
            const m = borderMargin + 1
            setBorderMargin(m)
            setDraftBorderMargins({ top: m, bottom: m, left: m, right: m })
          }}
        >
          +
        </button>
      </div>

      <details className="selected-subsection">
        <summary>Adjust sides separately (elongate/inset)</summary>
        <div className="side-margins-grid">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <div key={side} className="side-margin-item">
              <span className="side-margin-label">{side.charAt(0).toUpperCase() + side.slice(1)}:</span>
              <div className="stepper-row stepper-row--compact">
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={draftBorderMargins[side] <= 0}
                  onClick={() => {
                    setIndependentBorderMargins(true)
                    setDraftBorderMargins((prev) => ({ ...prev, [side]: Math.max(0, prev[side] - 1) }))
                  }}
                >
                  −
                </button>
                <span className="stepper-value">{draftBorderMargins[side]}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={draftBorderMargins[side] >= 20}
                  onClick={() => {
                    setIndependentBorderMargins(true)
                    setDraftBorderMargins((prev) => ({ ...prev, [side]: prev[side] + 1 }))
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>

      {!borderFitsCanvas && <p className="field-hint">The canvas is too small for this border.</p>}
      <button
        type="button"
        className="primary-btn"
        disabled={!borderFitsCanvas}
        onClick={() => {
          if (selectedObject?.kind === 'pixels' && selectedObject.borderMeta) {
            updateBorderObject({
              borderId: draftBorderId,
              margins: independentBorderMargins
                ? draftBorderMargins
                : { top: borderMargin, bottom: borderMargin, left: borderMargin, right: borderMargin },
              sides: draftBorderSides,
              mainColor: draftBorderColor,
              accentColor: draftBorderAccent,
            })
          } else {
            addBorder()
          }
        }}
      >
        {selectedObject?.kind === 'pixels' && selectedObject.borderMeta ? 'Update selected border' : 'Add border'}
      </button>
      <button
        type="button"
        className={`toggle-btn${snapEnabled ? ' toggle-btn--active' : ''}`}
        title="While dragging, pull objects onto the canvas center and edges and other objects' edges and centers. Hold Alt to drag freely."
        onClick={toggleSnap}
      >
        Snap to guides: {snapEnabled ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className={`toggle-btn${iconEditorOn ? ' toggle-btn--active' : ''}`}
        onClick={toggleIconEditor}
      >
        Icon editor: {iconEditorOn ? 'on' : 'off'}
      </button>
    </>
  )
  const draftFont = getFont(draftFontId)
  const draftSize = measureText(draftText, draftFont, 'horizontal', 1)
  const textBody = (
    <>
      <input
        type="text"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        placeholder="Type a phrase"
      />
      <TextWarnings text={draftText} font={draftFont} />
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
      <ColorSwatchPicker selected={draftTextColor} onSelect={setDraftTextColor} projectColors={paletteColors} />
      <button type="button" className="primary-btn" onClick={addTextObject}>
        Add text
      </button>
    </>
  )
  const draftIcon = getIcon(draftIconId)
  const draftIconSize = measureIcon(draftIcon, 1)
  const draftIconHasAccent = iconHasAccent(draftIcon)
  const allIcons = [...ICON_LIBRARY, ...customIcons]
  const draftIsCustom = customIcons.some((i) => i.id === draftIconId)
  const trimmedIconQuery = iconQuery.trim().toLowerCase()
  const matchingIcons = trimmedIconQuery
    ? allIcons.filter((i) => i.name.toLowerCase().includes(trimmedIconQuery) || i.id.toLowerCase().includes(trimmedIconQuery))
    : []
  const iconsBody = (
    <>
      <div className="icon-action-bar">
        <div className="icon-action-bar__info">
          <div className="icon-action-bar__preview">
            <IconThumb
              icon={draftIcon}
              color={draftIconColor.hex}
              accentColor={draftIconAccent.hex}
            />
          </div>
          <div className="icon-action-bar__details">
            <strong className="icon-action-bar__name">{draftIcon.name}</strong>
            <span className="icon-action-bar__size">
              {draftIconSize.width}×{draftIconSize.height} stitches
            </span>
          </div>
        </div>
        <button type="button" className="primary-btn" onClick={() => addIconObject()}>
          Add icon
        </button>
      </div>

      <div className="icon-search-row">
        <input
          type="search"
          placeholder="Search icons (e.g. cat, star, coffee)..."
          value={iconQuery}
          onChange={(e) => setIconQuery(e.target.value)}
        />
        {iconQuery && (
          <button type="button" className="icon-search-clear" onClick={() => setIconQuery('')} aria-label="Clear icon search">
            ✕
          </button>
        )}
      </div>

      {trimmedIconQuery ? (
        matchingIcons.length === 0 ? (
          <p className="tool-placeholder">No icons match “{iconQuery}”.</p>
        ) : (
          <div className="icon-search-results">
            <span className="field-label">Found {matchingIcons.length} icon{matchingIcons.length === 1 ? '' : 's'}</span>
            <div className="icon-grid">
              {matchingIcons.map((icon) => {
                const active = draftIconId === icon.id
                const preview = iconPreviewColors(icon)
                return (
                  <button
                    key={icon.id}
                    type="button"
                    className={`icon-thumb-btn${active ? ' icon-thumb-btn--active' : ''}`}
                    title={`${icon.name} (Double-click to add)`}
                    onClick={() => selectDraftIcon(icon)}
                    onDoubleClick={() => {
                      selectDraftIcon(icon)
                      addIconObject(icon)
                    }}
                  >
                    <IconThumb
                      icon={icon}
                      color={active ? draftIconColor.hex : preview.color}
                      accentColor={active ? draftIconAccent.hex : preview.accent}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )
      ) : (
        ICON_GROUPS.map((group) => {
          const icons = allIcons.filter((i) => i.group === group.id)
          if (icons.length === 0) return null
          const isOpen = openIconGroup === group.id
          return (
            <div key={group.id} className="icon-group">
              <button
                type="button"
                className="icon-group__header"
                aria-expanded={isOpen}
                onClick={() => setOpenIconGroup(isOpen ? '' : group.id)}
              >
                <span>{group.name}</span>
                <span className="icon-group__count">{icons.length}</span>
              </button>
              {isOpen && (
                <div className="icon-grid">
                  {icons.map((icon) => {
                    const active = draftIconId === icon.id
                    const preview = iconPreviewColors(icon)
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        className={`icon-thumb-btn${active ? ' icon-thumb-btn--active' : ''}`}
                        title={`${icon.name} (Double-click to add)`}
                        onClick={() => selectDraftIcon(icon)}
                        onDoubleClick={() => {
                          selectDraftIcon(icon)
                          addIconObject(icon)
                        }}
                      >
                        <IconThumb
                          icon={icon}
                          color={active ? draftIconColor.hex : preview.color}
                          accentColor={active ? draftIconAccent.hex : preview.accent}
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
      <label className="field-label">{draftIconHasAccent ? 'Main color' : 'Color'}</label>
      <ColorSwatchPicker selected={draftIconColor} onSelect={setDraftIconColor} projectColors={paletteColors} />
      {draftIconHasAccent && (
        <>
          <label className="field-label">Accent color</label>
          <p className="field-hint">This icon has a second color for its details.</p>
          <ColorSwatchPicker selected={draftIconAccent} onSelect={setDraftIconAccent} projectColors={paletteColors} />
        </>
      )}
      <button type="button" className="primary-btn" onClick={() => addIconObject()}>
        Add icon
      </button>
      {iconEditorOn && (
        <div className="icon-editor-panel">
          <button type="button" onClick={editIconAsDrawing}>
            Edit this icon as a drawing
          </button>
          {draftIsCustom &&
            (confirmingDeleteIcon ? (
              <div className="button-row">
                <button type="button" className="danger-btn" onClick={deleteCustomIcon}>
                  Delete from My icons
                </button>
                <button type="button" onClick={() => setConfirmingDeleteIcon(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="danger-btn" onClick={() => setConfirmingDeleteIcon(true)}>
                Delete this icon
              </button>
            ))}
        </div>
      )}
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
            <IconThumb icon={icon} color={draftIconColor.hex} pixelSize={6} />
          </button>
        ))}
      </div>
      <ColorSwatchPicker selected={draftIconColor} onSelect={setDraftIconColor} projectColors={paletteColors} />
      <button type="button" className={stampMode ? 'toggle-btn--active' : ''} onClick={toggleStampMode}>
        {stampMode ? 'Done stamping' : 'Stamp mode'}
      </button>
    </>
  )
  const iconSaveTargetId = iconEditorOn ? (activePixelObjectId ?? (selectedObject?.kind === 'pixels' ? selectedObject.id : null)) : null
  const iconSaveForm = iconSaveTargetId && (
    <div className="icon-editor-panel">
      <label className="field-label">Save drawing as icon</label>
      <input
        type="text"
        value={iconSaveName}
        placeholder="Icon name"
        onChange={(e) => setIconSaveName(e.target.value)}
      />
      <button type="button" className="primary-btn" onClick={saveIconFromDrawing}>
        Save to My icons
      </button>
      {iconSaveError && <p className="field-hint icon-editor-panel__error">{iconSaveError}</p>}
      {savedIcon && (
        <>
          <p className="field-hint">Saved. To make it a built-in icon, paste this into an icon file:</p>
          <select value={snippetGroup} onChange={(e) => setSnippetGroup(e.target.value)}>
            {ICON_GROUPS.filter((g) => g.id !== CUSTOM_GROUP).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <textarea
            className="icon-editor-panel__source"
            readOnly
            rows={Math.min(savedIcon.rows.length + 10, 24)}
            value={iconToSource(savedIcon, snippetGroup)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </>
      )}
    </div>
  )
  const drawBody = (
    <>
      <div className="button-row">
        <button
          type="button"
          className={`toggle-btn${!drawErase && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawErase(false)
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Paint
        </button>
        <button
          type="button"
          className={`toggle-btn${drawErase && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawErase(true)
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Erase
        </button>
        <button
          type="button"
          className={`toggle-btn${eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setEyedropperActive((v) => !v)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Pipette
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          className={`toggle-btn${drawShape === 'free' && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawShape('free')
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Freehand
        </button>
        <button
          type="button"
          className={`toggle-btn${drawShape === 'line' && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawShape('line')
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Straight line
        </button>
        <button
          type="button"
          className={`toggle-btn${drawShape === 'rect' && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawShape('rect')
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Box fill
        </button>
        <button
          type="button"
          className={`toggle-btn${drawShape === 'fill' && !eyedropperActive ? ' toggle-btn--active' : ''}`}
          onClick={() => {
            setDrawShape('fill')
            setEyedropperActive(false)
            if (!drawMode) toggleDrawMode()
          }}
        >
          Fill area
        </button>
      </div>
      {(drawShape === 'free' || drawShape === 'line') && (
        <div className="brush-size-row">
          <span className="field-label">Brush size:</span>
          <div className="segmented-control" role="group" aria-label="Brush size">
            {[1, 2, 3, 4].map((size) => (
              <button
                key={size}
                type="button"
                className={`toggle-btn${drawBrushSize === size ? ' toggle-btn--active' : ''}`}
                onClick={() => setDrawBrushSize(size)}
              >
                {size}×{size}
              </button>
            ))}
          </div>
        </div>
      )}
      {!drawErase && <ColorSwatchPicker selected={drawColor} onSelect={setDrawColor} projectColors={paletteColors} />}
      <button
        type="button"
        className={drawMode ? 'toggle-btn--active' : ''}
        onClick={toggleDrawMode}
      >
        {drawMode ? 'Done drawing' : 'Start drawing'}
      </button>
      {iconSaveForm}
    </>
  )

  const toolSections: { key: ToolTab; tab: string; title: string; body: React.ReactNode; defaultOpen: boolean }[] = [
    { key: 'text', tab: 'Text', title: 'Text', body: textBody, defaultOpen: true },
    { key: 'icons', tab: 'Icons', title: 'Icons', body: iconsBody, defaultOpen: true },
    { key: 'stamp', tab: 'Stamp', title: 'Stamp (tiny decorations)', body: stampBody, defaultOpen: false },
    { key: 'draw', tab: 'Draw', title: 'Draw', body: drawBody, defaultOpen: false },
    { key: 'canvas', tab: 'Canvas', title: 'Canvas & Border', body: canvasBody, defaultOpen: false },
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
          <select
            aria-label="Load example"
            title="Open a ready-made example design in a new slot"
            value=""
            onChange={(e) => loadExample(e.target.value)}
          >
            <option value="" disabled>
              Load example…
            </option>
            {EXAMPLES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
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
            <p>Start a new design? "{project.name}" stays saved — switch back to it any time from the Design menu.</p>
            <div className="button-row">
              <button type="button" className="danger-btn" onClick={startNewProject}>
                Start new design
              </button>
              <button type="button" onClick={() => setConfirmingNewProject(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {selectedObject && (
          <div className="tool-section selected-panel" ref={selectedPanelRef}>
            <div className="selected-panel__header">
              <h3>Selected {selectedBorder ? 'border' : selectedObject.kind === 'pixels' ? 'drawing' : selectedObject.kind}</h3>
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
              {selectedBorder
                ? `${getBorder(selectedBorder.borderMeta.borderId).name} border (${selectedBorder.cells.length} stitches)`
                : selectedObject.kind === 'text'
                  ? `"${selectedObject.content}"`
                  : selectedObject.kind === 'icon'
                    ? getIcon(selectedObject.iconId).name
                    : `${selectedObject.cells.length}-stitch drawing`}
            </p>
            {selectedObject.kind === 'pixels' && !selectedBorder && iconSaveForm}

            {selectedBorder && (
              <div className="border-edit-controls">
                <label className="field-label">Border style</label>
                <select
                  value={selectedBorder.borderMeta.borderId}
                  onChange={(e) => updateBorderObject({ borderId: e.target.value })}
                >
                  {BORDERS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <label className="field-label">Sides</label>
                <div className="button-row">
                  <button
                    type="button"
                    className={`toggle-btn${isAllSides(selectedBorder.borderMeta.sides) ? ' toggle-btn--active' : ''}`}
                    onClick={() => updateBorderObject({ sides: { top: true, bottom: true, left: true, right: true } })}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn${isTopBottomSides(selectedBorder.borderMeta.sides) ? ' toggle-btn--active' : ''}`}
                    onClick={() => updateBorderObject({ sides: { top: true, bottom: true, left: false, right: false } })}
                  >
                    Top & Bottom
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn${isLeftRightSides(selectedBorder.borderMeta.sides) ? ' toggle-btn--active' : ''}`}
                    onClick={() => updateBorderObject({ sides: { top: false, bottom: false, left: true, right: true } })}
                  >
                    Left & Right
                  </button>
                </div>
                <div className="button-row">
                  {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                    const active = selectedBorder.borderMeta.sides[side]
                    return (
                      <button
                        key={side}
                        type="button"
                        className={`toggle-btn${active ? ' toggle-btn--active' : ''}`}
                        onClick={() =>
                          updateBorderObject({
                            sides: {
                              ...selectedBorder.borderMeta.sides,
                              [side]: !active,
                            },
                          })
                        }
                      >
                        {side.charAt(0).toUpperCase() + side.slice(1)}
                      </button>
                    )
                  })}
                </div>

                <label className="field-label">Distance from edge</label>
                <div className="stepper-row">
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={selectedBorder.borderMeta.margins.top <= 0}
                    onClick={() => setBorderMarginUniform(selectedBorder.borderMeta.margins.top - 1)}
                  >
                    −
                  </button>
                  <span className="stepper-value">{selectedBorder.borderMeta.margins.top} stitches</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={selectedBorder.borderMeta.margins.top >= 15}
                    onClick={() => setBorderMarginUniform(selectedBorder.borderMeta.margins.top + 1)}
                  >
                    +
                  </button>
                </div>

                <details className="selected-subsection">
                  <summary>Adjust sides separately (elongate/inset)</summary>
                  <div className="side-margins-grid">
                    {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                      <div key={side} className="side-margin-item">
                        <span className="side-margin-label">{side.charAt(0).toUpperCase() + side.slice(1)}:</span>
                        <div className="stepper-row stepper-row--compact">
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={selectedBorder.borderMeta.margins[side] <= 0}
                            onClick={() =>
                              updateBorderObject({
                                margins: {
                                  ...selectedBorder.borderMeta.margins,
                                  [side]: Math.max(0, selectedBorder.borderMeta.margins[side] - 1),
                                },
                              })
                            }
                          >
                            −
                          </button>
                          <span className="stepper-value">{selectedBorder.borderMeta.margins[side]}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={selectedBorder.borderMeta.margins[side] >= 20}
                            onClick={() =>
                              updateBorderObject({
                                margins: {
                                  ...selectedBorder.borderMeta.margins,
                                  [side]: selectedBorder.borderMeta.margins[side] + 1,
                                },
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                <label className="field-label">
                  {borderHasAccent(getBorder(selectedBorder.borderMeta.borderId)) ? 'Main color' : 'Color'}
                </label>
                <ColorSwatchPicker
                  selected={selectedBorder.borderMeta.mainColor}
                  onSelect={(c) => updateBorderObject({ mainColor: c })}
                  projectColors={paletteColors}
                />
                {borderHasAccent(getBorder(selectedBorder.borderMeta.borderId)) && (
                  <>
                    <label className="field-label">Accent color</label>
                    <ColorSwatchPicker
                      selected={selectedBorder.borderMeta.accentColor}
                      onSelect={(c) => updateBorderObject({ accentColor: c })}
                      projectColors={paletteColors}
                    />
                  </>
                )}
              </div>
            )}

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
                  const size = measureText(selectedObject.content, font, selectedObject.direction, selectedObject.scale)
                  return (
                    <>
                      <TextWarnings text={selectedObject.content} font={font} />
                      <p className="tool-placeholder">
                        {size.width}×{size.height} stitches
                        {(size.width > project.widthStitches || size.height > project.heightStitches) &&
                          ' — larger than the canvas'}
                      </p>
                    </>
                  )
                })()}

                <div className="button-row">
                  <button
                    type="button"
                    disabled={splitTextObject(selectedObject).length < 2}
                    onClick={splitSelectedText}
                    title="Replace this text with one object per letter, so each can be moved or recolored on its own"
                  >
                    Split into letters
                  </button>
                </div>

                <label className="field-label">Font</label>
                <select
                  value={getFont(selectedObject.font).id}
                  onChange={(e) => updateTextObject({ font: e.target.value })}
                >
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

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
                <label className="field-label">
                  {selectedObject.kind === 'icon' && iconHasAccent(getIcon(selectedObject.iconId)) ? 'Main color' : 'Color'}
                </label>
                <ColorSwatchPicker
                  selected={selectedObject.color}
                  onSelect={(c) =>
                    selectedObject.kind === 'text' ? updateTextObject({ color: c }) : updateIconObject({ color: c })
                  }
                  projectColors={paletteColors}
                />
                {selectedObject.kind === 'icon' && iconHasAccent(getIcon(selectedObject.iconId)) && (
                  <>
                    <label className="field-label">Accent color</label>
                    <p className="field-hint">This icon has a second color for its details.</p>
                    <ColorSwatchPicker
                      selected={accentColorOf(selectedObject)}
                      onSelect={(c) => updateIconObject({ color2: c })}
                      projectColors={paletteColors}
                    />
                  </>
                )}
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
                        className={`toggle-btn${displayRotation(selectedObject.rotation, selectedObject.mirrorH, selectedObject.mirrorV) === angle ? ' toggle-btn--active' : ''}`}
                        onClick={() => rotateSelectedObject(angle)}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </>
              )}
              {flipControls}
              {alignControls}
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
                      onChange={(e) => setRepeatCount(e.target.value)}
                      onBlur={() => setRepeatCount(String(clampRepeatCount(repeatCount)))}
                    />
                  </label>
                  <label>
                    Gap
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={repeatSpacing}
                      onChange={(e) => setRepeatSpacing(e.target.value)}
                      onBlur={() => setRepeatSpacing(String(clampRepeatSpacing(repeatSpacing)))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const count = clampRepeatCount(repeatCount)
                    const spacing = clampRepeatSpacing(repeatSpacing)
                    setRepeatCount(String(count))
                    setRepeatSpacing(String(spacing))
                    repeatSelectedObject(count, spacing, repeatDirection)
                  }}
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

            <details className="selected-subsection">
              <summary>Align &amp; distribute</summary>
              {flipControls}
              {alignControls}
              <label className="field-label">Space evenly</label>
              <div className="button-row">
                <button type="button" disabled={selectionUnitCount < 3} onClick={() => distributeSelection('horizontal')}>
                  Across
                </button>
                <button type="button" disabled={selectionUnitCount < 3} onClick={() => distributeSelection('vertical')}>
                  Down
                </button>
              </div>
              {selectionUnitCount < 3 && <p className="tool-placeholder">Spacing evenly needs three or more objects or groups.</p>}
            </details>
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
                ? eyedropperActive
                  ? 'Pipette active — tap any stitch on the canvas to pick its color'
                  : drawShape === 'fill'
                    ? `Fill area — tap inside an outline to ${drawErase ? 'erase' : 'fill'}`
                    : drawShape === 'rect'
                      ? `Box fill — drag a rectangle to ${drawErase ? 'erase' : 'fill'}`
                      : `Drawing (${drawBrushSize}×${drawBrushSize} ${drawShape === 'line' ? 'straight line' : 'brush'}) — ${drawShape === 'line' ? 'drag to draw line' : 'tap or drag'} to ${drawErase ? 'erase' : 'paint'}`
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
            drawShape={drawShape}
            drawBrushSize={drawBrushSize}
            drawColor={drawColor}
            eyedropperActive={eyedropperActive}
            onPickColor={(color) => {
              setDrawColor(color)
              setDrawErase(false)
              setEyedropperActive(false)
            }}
            onPaintCells={paintPixels}
            onEraseCells={erasePixels}
            stampMode={stampMode}
            onStamp={addIconObjectAt}
            symbols={symbols}
            showSymbols={showSymbols}
            snapEnabled={snapEnabled}
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
                  if (t.key !== 'stamp') setStampMode(false)
                  if (t.key !== 'draw') {
                    setDrawMode(false)
                    setActivePixelObjectId(null)
                  }
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
                <button
                  type="button"
                  className="palette-list__replace"
                  aria-expanded={replacingCode === c.dmcCode}
                  onClick={() => setReplacingCode(replacingCode === c.dmcCode ? null : c.dmcCode)}
                >
                  Replace
                </button>
                {replacingCode === c.dmcCode && (
                  <div className="palette-list__picker">
                    <ColorSwatchPicker selected={c} onSelect={(to) => replaceEverywhere(c.dmcCode, to)} startExpanded />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

export default App
