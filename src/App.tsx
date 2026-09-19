import { useEffect, useState } from 'react'
import { CanvasGrid, CELL_SIZE } from './components/CanvasGrid'
import { ColorSwatchPicker } from './components/ColorSwatchPicker'
import { IconThumb } from './components/IconThumb'
import { createEmptyProject, type IconObject, type TextDirection, type TextObject } from './lib/types'
import { loadProject, saveProject } from './lib/storage'
import { AVAILABLE_FONTS, getFont } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { measureText } from './lib/textRender'
import { ICON_LIBRARY, getIcon } from './lib/icons'
import { measureIcon } from './lib/iconRender'
import { clampToCanvas, MAX_OBJECT_SCALE } from './lib/objectMeasure'
import { createId } from './lib/id'
import { alignObject, type Alignment } from './lib/align'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    saveProject(project)
  }, [project])

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

  function moveObject(id: string, x: number, y: number) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id ? { ...o, x, y } : o)),
    }))
  }

  function resizeObject(id: string, patch: { scale: number; x: number; y: number }) {
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
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
    } else {
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

  return (
    <div className="app-shell">
      <aside className="toolbar">
        <h2>Tools</h2>
        <button type="button" onClick={() => setProject(createEmptyProject('Untitled'))}>
          New project
        </button>

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
        </div>

        {selectedObject && (
          <div className="tool-section selected-panel">
            <h3>Selected {selectedObject.kind}</h3>
            <p className="selected-panel__label">
              {selectedObject.kind === 'text' ? `"${selectedObject.content}"` : getIcon(selectedObject.iconId).name}
            </p>

            {selectedObject.kind === 'text' && (
              <>
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

            <label className="field-label">Color</label>
            <ColorSwatchPicker
              selected={selectedObject.color}
              onSelect={(c) =>
                selectedObject.kind === 'text' ? updateTextObject({ color: c }) : updateIconObject({ color: c })
              }
            />

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

            <button type="button" className="danger-btn" onClick={deleteSelectedObject}>
              Delete
            </button>
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
          />
        </div>
      </main>

      <aside className="palette-panel">
        <h2>Palette</h2>
        {project.objects.length === 0 ? (
          <p className="tool-placeholder">DMC colors used in this design will list here.</p>
        ) : (
          <ul className="palette-list">
            {[...new Map(project.objects.map((o) => [o.color.dmcCode, o.color])).values()].map((c) => (
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
