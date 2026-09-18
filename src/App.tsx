import { useEffect, useState } from 'react'
import { CanvasGrid } from './components/CanvasGrid'
import { createEmptyProject } from './lib/types'
import { loadProject, saveProject } from './lib/storage'
import './App.css'

function App() {
  const [project, setProject] = useState(() => loadProject() ?? createEmptyProject('Untitled'))

  useEffect(() => {
    saveProject(project)
  }, [project])

  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)

  return (
    <div className="app-shell">
      <aside className="toolbar">
        <h2>Tools</h2>
        <button type="button" onClick={() => setProject(createEmptyProject('Untitled'))}>
          New project
        </button>
        <p className="tool-placeholder">Text, icon, and color tools go here.</p>
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
          />
        </div>
      </main>

      <aside className="palette-panel">
        <h2>Palette</h2>
        <p className="tool-placeholder">DMC colors used in this design will list here.</p>
      </aside>
    </div>
  )
}

export default App
