import { useEffect, useState } from 'react'
import { CanvasGrid } from './components/CanvasGrid'
import { createEmptyProject, type TextDirection, type TextObject } from './lib/types'
import { loadProject, saveProject } from './lib/storage'
import { AVAILABLE_FONTS, getFont } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { measureText } from './lib/textRender'
import './App.css'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

function App() {
  const [project, setProject] = useState(() => loadProject() ?? createEmptyProject('Untitled'))
  const [draftText, setDraftText] = useState('')
  const [draftFontId, setDraftFontId] = useState(AVAILABLE_FONTS[0].id)
  const [draftColor, setDraftColor] = useState(DMC_STARTER_COLORS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    saveProject(project)
  }, [project])

  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)
  const selectedObject = project.objects.find((o) => o.id === selectedId) ?? null

  function addTextObject() {
    if (!draftText.trim()) return
    const font = getFont(draftFontId)
    const { width, height } = measureText(draftText, font, 'horizontal', 1)
    const newObject: TextObject = {
      id: crypto.randomUUID(),
      kind: 'text',
      content: draftText,
      font: draftFontId,
      direction: 'horizontal',
      scale: 1,
      x: Math.max(0, Math.floor((project.widthStitches - width) / 2)),
      y: Math.max(0, Math.floor((project.heightStitches - height) / 2)),
      color: draftColor,
    }
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
    setDraftText('')
  }

  function updateSelectedObject(patch: Partial<TextObject>) {
    if (!selectedObject) return
    setProject((p) => ({
      ...p,
      objects: p.objects.map((o) =>
        o.id === selectedObject.id && o.kind === 'text' ? { ...o, ...patch } : o,
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
          <div className="swatch-row">
            {DMC_STARTER_COLORS.map((c) => (
              <button
                key={c.dmcCode}
                type="button"
                className={`swatch${draftColor.dmcCode === c.dmcCode ? ' swatch--selected' : ''}`}
                style={{ backgroundColor: c.hex }}
                title={`DMC ${c.dmcCode} · ${c.name}`}
                onClick={() => setDraftColor(c)}
              />
            ))}
          </div>
          <button type="button" onClick={addTextObject}>
            Add text
          </button>
        </div>

        {selectedObject && selectedObject.kind === 'text' && (
          <div className="tool-section selected-panel">
            <h3>Selected text</h3>
            <p className="selected-panel__label">"{selectedObject.content}"</p>

            <label className="field-label">Direction</label>
            <div className="button-row">
              {(['horizontal', 'vertical'] as TextDirection[]).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`toggle-btn${selectedObject.direction === dir ? ' toggle-btn--active' : ''}`}
                  onClick={() => updateSelectedObject({ direction: dir })}
                >
                  {dir === 'horizontal' ? 'Across' : 'Down'}
                </button>
              ))}
            </div>

            <label className="field-label">Size</label>
            <div className="button-row">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`toggle-btn${selectedObject.scale === s ? ' toggle-btn--active' : ''}`}
                  onClick={() => updateSelectedObject({ scale: s })}
                >
                  {s}×
                </button>
              ))}
            </div>

            <label className="field-label">Color</label>
            <div className="swatch-row">
              {DMC_STARTER_COLORS.map((c) => (
                <button
                  key={c.dmcCode}
                  type="button"
                  className={`swatch${selectedObject.color.dmcCode === c.dmcCode ? ' swatch--selected' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  title={`DMC ${c.dmcCode} · ${c.name}`}
                  onClick={() => updateSelectedObject({ color: c })}
                />
              ))}
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
