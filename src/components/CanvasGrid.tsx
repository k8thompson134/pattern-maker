import { useState, useRef } from 'react'
import type { CanvasObject } from '../lib/types'
import { getFont } from '../lib/fonts'
import { renderTextToCells, type FilledCell } from '../lib/textRender'
import { getIcon } from '../lib/icons'
import { renderIconToCells } from '../lib/iconRender'
import { measureObject } from '../lib/objectMeasure'

type CanvasGridProps = {
  widthStitches: number
  heightStitches: number
  zoom: number
  objects: CanvasObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
}

export const CELL_SIZE = 16

function renderObjectCells(obj: CanvasObject): FilledCell[] {
  if (obj.kind === 'text') {
    return renderTextToCells(obj.content, getFont(obj.font), obj.direction, obj.scale)
  }
  return renderIconToCells(getIcon(obj.iconId), obj.scale)
}

export function CanvasGrid({
  widthStitches,
  heightStitches,
  zoom,
  objects,
  selectedId,
  onSelect,
  onMove,
}: CanvasGridProps) {
  const cell = CELL_SIZE * zoom
  const pixelWidth = widthStitches * cell
  const pixelHeight = heightStitches * cell

  const dragRef = useRef<{
    id: string
    startPointerX: number
    startPointerY: number
    startObjX: number
    startObjY: number
    maxX: number
    maxY: number
  } | null>(null)

  // Live drag position lives here, not in the parent's saved project — committing
  // every pixel of movement up to the parent triggers a localStorage write on every
  // pointermove event, which is what was making dragging feel laggy. Only the final
  // position gets committed (and saved) on pointer-up.
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)

  const lines: React.ReactNode[] = []
  for (let x = 0; x <= widthStitches; x++) {
    lines.push(
      <line key={`v${x}`} x1={x * cell} y1={0} x2={x * cell} y2={pixelHeight} />,
    )
  }
  for (let y = 0; y <= heightStitches; y++) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y * cell} x2={pixelWidth} y2={y * cell} />,
    )
  }

  function handlePointerDown(e: React.PointerEvent, obj: CanvasObject) {
    e.stopPropagation()
    onSelect(obj.id)
    const { width, height } = measureObject(obj)
    dragRef.current = {
      id: obj.id,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startObjX: obj.x,
      startObjY: obj.y,
      maxX: Math.max(0, widthStitches - width),
      maxY: Math.max(0, heightStitches - height),
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const deltaX = Math.round((e.clientX - drag.startPointerX) / cell)
    const deltaY = Math.round((e.clientY - drag.startPointerY) / cell)
    const nextX = Math.min(Math.max(0, drag.startObjX + deltaX), drag.maxX)
    const nextY = Math.min(Math.max(0, drag.startObjY + deltaY), drag.maxY)
    setDragPreview({ id: drag.id, x: nextX, y: nextY })
  }

  function handlePointerUp() {
    const drag = dragRef.current
    if (drag && dragPreview) {
      onMove(drag.id, dragPreview.x, dragPreview.y)
    }
    dragRef.current = null
    setDragPreview(null)
  }

  return (
    <svg
      className="canvas-grid"
      width={pixelWidth}
      height={pixelHeight}
      viewBox={`0 0 ${pixelWidth} ${pixelHeight}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <rect
        x={0}
        y={0}
        width={pixelWidth}
        height={pixelHeight}
        className="canvas-grid__bg"
        onPointerDown={() => onSelect(null)}
      />
      <g className="canvas-grid__objects">
        {objects.map((obj) => {
          const cells = renderObjectCells(obj)
          const isSelected = obj.id === selectedId
          const posX = obj.id === dragPreview?.id ? dragPreview.x : obj.x
          const posY = obj.id === dragPreview?.id ? dragPreview.y : obj.y
          return (
            <g
              key={obj.id}
              className={isSelected ? 'canvas-object canvas-object--selected' : 'canvas-object'}
              onPointerDown={(e) => handlePointerDown(e, obj)}
            >
              {cells.map((c, i) => (
                <rect
                  key={i}
                  x={(posX + c.dx) * cell}
                  y={(posY + c.dy) * cell}
                  width={cell}
                  height={cell}
                  fill={obj.color.hex}
                  stroke={isSelected ? '#646cff' : undefined}
                  strokeWidth={isSelected ? 1 : undefined}
                />
              ))}
            </g>
          )
        })}
      </g>
      <g className="canvas-grid__lines">{lines}</g>
    </svg>
  )
}
