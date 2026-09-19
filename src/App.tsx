import { useEffect, useState } from 'react'
import { CanvasGrid, CELL_SIZE } from './components/CanvasGrid'
import { ColorSwatchPicker } from './components/ColorSwatchPicker'
import { IconThumb } from './components/IconThumb'
import { createEmptyProject, type IconObject, type TextDirection, type TextObject } from './lib/types'
import { loadProject, saveProject } from './lib/storage'
import { AVAILABLE_FONTS, getFont } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { measureText } from './lib/textRender'
import { ICON_LIBRARY, MINI_ICON_LIBRARY, getIcon } from './lib/icons'
import { measureIcon } from './lib/iconRender'
import { clampToCanvas, measureObject, MAX_OBJECT_SCALE } from './lib/objectMeasure'
import { createId } from './lib/id'
import { alignObject, type Alignment } from './lib/align'
import { createEmptyPixelObject, eraseCell, paintCell } from './lib/pixelObject'
import { exportProjectToPdf } from './lib/exportPdf'
import './App.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5

function App() {
  const [project, setProject] = useState(() => loadProject() ?? createEmptyProject('Untitled'))
  const [draftText, setDraftText] = useState('')
  const [draftFontId, setDraftFontId] = useState(AVAILABLE_FONTS[0].id)
  const [draftTextColor, setDraftTextColor] = useState(DMC_STARTER_COLORS[0])
  const [draftIconId, setDraftIconId] = useState(ICON_LIBRARY[0].id)
  const [draftIconColor, setDraftIconColor] = useState(DMC_STARTER_COLORS[0])
  const [draftMiniIconId, setDraftMiniIconId] = useState(MINI_ICON_LIBRARY[0].id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  useEffect(() => {
    saveProject(project)
  }, [project])

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
      setProject((p) => ({ ...p, zoom: Math.max(MIN_ZOOM, fitZoom) }))
    }
    // run once on initial load only — a narrow screen should start zoomed to fit,
    // but shouldn't fight the user's own zoom choice on every resize afterward
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)
  const selectedObject = project.objects.find((o) => o.id === selectedId) ?? null

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

  function updateTextObject(patch: Partial<Omit<TextObject, 'id' | 'kind'>>) {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) =>
        o.id === selectedObject.id && o.kind === 'text'
          ? clampToCanvas({ ...o, ...patch }, p.widthStitches, p.heightStitches)
          : o,
      ),
      updatedAt: new Date().toISOString(),
    }))
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

  function deleteSelectedObject() {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.filter((o) => o.id !== selectedObject.id),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedId(null)
  }

  function duplicateSelectedObject() {
    if (!selectedObject) return
    const { width } = measureObject(selectedObject)
    const offset = Math.max(width, 2)
    const copy = { ...selectedObject, id: createId(), x: selectedObject.x + offset, y: selectedObject.y }
    setProject((p) => ({
      ...p,
      objects: [...p.objects, clampToCanvas(copy, p.widthStitches, p.heightStitches)],
      updatedAt: new Date().toISOString(),
    }))
    setSelectedId(copy.id)
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

  function moveObject(id: string, x: number, y: number) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id ? { ...o, x, y } : o)),
    }))
  }

  function resizeObject(id: string, patch: { scale: number; x: number; y: number }) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id && o.kind !== 'pixels' ? { ...o, ...patch } : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  function nudgeSelectedObject(dx: number, dy: number) {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) =>
        o.id === selectedObject.id
          ? clampToCanvas({ ...o, x: o.x + dx, y: o.y + dy }, p.widthStitches, p.heightStitches)
          : o,
      ),
      updatedAt: new Date().toISOString(),
    }))
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

  function erasePixel(gx: number, gy: number) {
    if (!activePixelObjectId) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === activePixelObjectId && o.kind === 'pixels' ? eraseCell(o, gx, gy) : o)),
      updatedAt: new Date().toISOString(),
    }))
  }

  function toggleDrawMode() {
    setDrawMode((wasOn) => {
      if (wasOn) setActivePixelObjectId(null)
      return !wasOn
    })
    setStampMode(false)
    setSelectedId(null)
  }

  function toggleStampMode() {
    setStampMode((wasOn) => !wasOn)
    setDrawMode(false)
    setActivePixelObjectId(null)
    setSelectedId(null)
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
      if (!selectedId) return
      const active = document.activeElement
      const isTyping =
        active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement
      if (isTyping) return

      const step = e.shiftKey ? 5 : 1
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          nudgeSelectedObject(-step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudgeSelectedObject(step, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          nudgeSelectedObject(0, -step)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudgeSelectedObject(0, step)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedObject])

  function setZoom(zoom: number) {
    setProject((p) => ({ ...p, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }))
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

  return (
    <div className="app-shell">
      <aside className="toolbar">
        <h2>Tools</h2>
        <div className="button-row">
          <button type="button" onClick={() => setProject((p) => ({ ...createEmptyProject('Untitled'), zoom: p.zoom }))}>
            New project
          </button>
          <button
            type="button"
            onClick={() => {
              const title = window.prompt('PDF Title:', project.name || '')
              if (title !== null) {
                exportProjectToPdf(project, title || undefined)
              }
            }}
          >
            Export PDF
          </button>
        </div>

        <div className="tool-section">
          <h3>Canvas Size</h3>
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
        </div>

        <div className="tool-section">
          <h3>Text</h3>
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Type a phrase"
          />
          <select value={draftFontId} onChange={(e) => setDraftFontId(e.target.value)}>
            {AVAILABLE_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <ColorSwatchPicker selected={draftTextColor} onSelect={setDraftTextColor} />
          <button type="button" onClick={addTextObject}>
            Add text
          </button>
        </div>

        <div className="tool-section">
          <h3>Icons</h3>
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
          <button type="button" onClick={addIconObject}>
            Add icon
          </button>

          <label className="field-label">Stamp (tiny decoration icons)</label>
          <div className="icon-grid">
            {MINI_ICON_LIBRARY.map((icon) => (
              <button
                key={icon.id}
                type="button"
                className={`icon-thumb-btn${draftMiniIconId === icon.id ? ' icon-thumb-btn--active' : ''}`}
                title={icon.name}
                onClick={() => setDraftMiniIconId(icon.id)}
              >
                <IconThumb icon={icon} color="#ddd" pixelSize={4} />
              </button>
            ))}
          </div>
          <button type="button" className={stampMode ? 'toggle-btn--active' : ''} onClick={toggleStampMode}>
            {stampMode ? 'Done stamping' : 'Stamp mode'}
          </button>
          {stampMode && <p className="tool-placeholder">Tap the canvas to drop tiny icons as decoration.</p>}
        </div>

        <div className="tool-section">
          <h3>Draw</h3>
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
          {drawMode && (
            <p className="tool-placeholder">Tap cells on the canvas to {drawErase ? 'erase' : 'paint'}.</p>
          )}
        </div>

        {selectedObject && (
          <div className="tool-section selected-panel">
            <div className="selected-panel__header">
              <h3>Selected {selectedObject.kind === 'pixels' ? 'drawing' : selectedObject.kind}</h3>
              <div className="button-row">
                <button type="button" onClick={duplicateSelectedObject}>
                  Duplicate
                </button>
                <button type="button" className="danger-btn" onClick={deleteSelectedObject}>
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

            <label className="field-label">Layer</label>
            <div className="button-row">
              <button type="button" onClick={() => reorderSelectedObject('backward')}>
                Backward
              </button>
              <button type="button" onClick={() => reorderSelectedObject('forward')}>
                Forward
              </button>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => reorderSelectedObject('back')}>
                To Back
              </button>
              <button type="button" onClick={() => reorderSelectedObject('front')}>
                To Front
              </button>
            </div>

            {selectedObject.kind === 'text' && (
              <>
                <label className="field-label">Text</label>
                <input
                  type="text"
                  value={selectedObject.content}
                  onChange={(e) => updateTextObject({ content: e.target.value })}
                  placeholder="Edit text..."
                />

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

            {selectedObject.kind !== 'pixels' && (
              <>
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
              </>
            )}

            {selectedObject.kind !== 'pixels' && (
              <>
                <label className="field-label">Rotation</label>
                <div className="button-row">
                  {[0, 90, 180, 270].map((angle) => (
                    <button
                      key={angle}
                      type="button"
                      className={`toggle-btn${selectedObject.rotation === angle ? ' toggle-btn--active' : ''}`}
                      onClick={() =>
                        selectedObject.kind === 'text'
                          ? updateTextObject({ rotation: angle })
                          : updateIconObject({ rotation: angle })
                      }
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedObject.kind !== 'pixels' && (
              <>
                <label className="field-label">Repeat (border/string pattern)</label>
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
              </>
            )}

            <label className="field-label">Position</label>
            <div className="dpad">
              <span />
              <button type="button" className="dpad-btn" onClick={() => nudgeSelectedObject(0, -1)}>
                ↑
              </button>
              <span />
              <button type="button" className="dpad-btn" onClick={() => nudgeSelectedObject(-1, 0)}>
                ←
              </button>
              <span className="dpad-center" />
              <button type="button" className="dpad-btn" onClick={() => nudgeSelectedObject(1, 0)}>
                →
              </button>
              <span />
              <button type="button" className="dpad-btn" onClick={() => nudgeSelectedObject(0, 1)}>
                ↓
              </button>
              <span />
            </div>

            {selectedObject.kind !== 'pixels' && (
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
          </div>
        )}
      </aside>

      <main className="canvas-area">
        <div className="canvas-meta">
          <span>
            {project.widthStitches}×{project.heightStitches} stitches · {inchesWidth}"×{inchesHeight}" at{' '}
            {project.fabric.stitchesPerInch} stitches/inch
          </span>
          <span className="zoom-controls">
            <button type="button" onClick={() => setZoom(project.zoom - 0.25)} disabled={project.zoom <= MIN_ZOOM}>
              −
            </button>
            {Math.round(project.zoom * 100)}%
            <button type="button" onClick={() => setZoom(project.zoom + 0.25)} disabled={project.zoom >= MAX_ZOOM}>
              +
            </button>
          </span>
        </div>
        <div className="canvas-scroll">
          <CanvasGrid
            widthStitches={project.widthStitches}
            heightStitches={project.heightStitches}
            zoom={project.zoom}
            objects={project.objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveObject}
            onResize={resizeObject}
            drawMode={drawMode}
            drawErase={drawErase}
            onPaintCell={paintPixel}
            onEraseCell={erasePixel}
            stampMode={stampMode}
            onStamp={addIconObjectAt}
          />
        </div>
      </main>

      <aside className="palette-panel">
        <h2>Palette</h2>
        {paletteColors.length === 0 ? (
          <p className="tool-placeholder">DMC colors used in this design will list here.</p>
        ) : (
          <ul className="palette-list">
            {paletteColors.map((c) => (
              <li key={c.dmcCode}>
                <span className="swatch" style={{ backgroundColor: c.hex }} />
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
