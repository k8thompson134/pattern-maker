import { useEffect, useState } from 'react'
import { CanvasGrid } from './components/CanvasGrid'
import { createEmptyProject, type TextObject } from './lib/types'
import { loadProject, saveProject } from './lib/storage'
import { AVAILABLE_FONTS } from './lib/fonts'
import { DMC_STARTER_COLORS } from './lib/dmcColors'
import { measureText } from './lib/textRender'
import { getFont } from './lib/fonts'
import './App.css'

function App() {
  const [project, setProject] = useState(() => loadProject() ?? createEmptyProject('Untitled'))
  const [draftText, setDraftText] = useState('')
  const [draftFontId, setDraftFontId] = useState(AVAILABLE_FONTS[0].id)
  const [draftColor, setDraftColor] = useState(DMC_STARTER_COLORS[0])

  useEffect(() => {
    saveProject(project)
  }, [project])

  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)

  function addTextObject() {
    if (!draftText.trim()) return
    const font = getFont(draftFontId)
    const { width, height } = measureText(draftText, font)
    const newObject: TextObject = {
      id: crypto.randomUUID(),
      kind: 'text',
      content: draftText,
      font: draftFontId,
      x: Math.max(0, Math.floor((project.widthStitches - width) / 2)),
      y: Math.max(0, Math.floor((project.heightStitches - height) / 2)),
      color: draftColor,
    }
    setProject((p) => ({ ...p, objects: [...p.objects, newObject], updatedAt: new Date().toISOString() }))
    setDraftText('')
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
      </aside>

      <main className="canvas-area">
        <div className="canvas-meta">
          {project.widthStitches}×{project.heightStitches} stitches · {inchesWidth}"×{inchesHeight}" at{' '}
          {project.fabric.stitchesPerInch} stitches/inch
        </div>
        <div className="canvas-scroll">
          <CanvasGrid
            widthStitches={project.widthStitches}
            heightStitches={project.heightStitches}
            zoom={project.zoom}
            objects={project.objects}
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
