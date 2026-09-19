import { useRef, useState } from 'react'
import type { CanvasObject } from '../lib/types'
import { getFont } from '../lib/fonts'
import { renderTextToCells, type FilledCell } from '../lib/textRender'
import { getIcon } from '../lib/icons'
import { renderIconToCells } from '../lib/iconRender'
import { measureObject, MAX_OBJECT_SCALE } from '../lib/objectMeasure'
import { computeResizeFromHandle, type CornerHandle } from '../lib/resizeHandle'

type CanvasGridProps = {
  widthStitches: number
  heightStitches: number
  zoom: number
  objects: CanvasObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, patch: { scale: number; x: number; y: number }) => void
}

export const CELL_SIZE = 16
const HANDLE_SIZE = 24

function renderObjectCells(obj: CanvasObject): FilledCell[] {
  if (obj.kind === 'text') {
    return renderTextToCells(obj.content, getFont(obj.font), obj.direction, obj.scale)
  }
  return renderIconToCells(getIcon(obj.iconId), obj.scale)
}

const CORNER_HANDLES: CornerHandle[] = ['nw', 'ne', 'sw', 'se']

export function CanvasGrid({
  widthStitches,
  heightStitches,
  zoom,
  objects,
  selectedId,
  onSelect,
  onMove,
  onResize,
}: CanvasGridProps) {
  const cell = CELL_SIZE * zoom
  const pixelWidth = widthStitches * cell
  const pixelHeight = heightStitches * cell
  const svgRef = useRef<SVGSVGElement | null>(null)

  const dragRef = useRef<{
    id: string
    startPointerX: number
    startPointerY: number
    startObjX: number
    startObjY: number
    maxX: number
    maxY: number
  } | null>(null)

  // Live drag/resize state lives here, not in the parent's saved project — committing
  // every pixel of movement up to the parent triggers a localStorage write on every
  // pointermove event, which is what was making dragging feel laggy. Only the final
  // position/scale gets committed (and saved) on pointer-up.
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)

  const resizeRef = useRef<{
    id: string
    handle: CornerHandle
    anchorXStitch: number
    anchorYStitch: number
    baseWidth: number
    baseHeight: number
  } | null>(null)
  const [resizePreview, setResizePreview] = useState<{
    id: string
    scale: number
    x: number
    y: number
  } | null>(null)

  const lines: React.ReactNode[] = []
  for (let x = 0; x <= widthStitches; x++) {
    lines.push(<line key={`v${x}`} x1={x * cell} y1={0} x2={x * cell} y2={pixelHeight} />)
  }
  for (let y = 0; y <= heightStitches; y++) {
    lines.push(<line key={`h${y}`} x1={0} y1={y * cell} x2={pixelWidth} y2={y * cell} />)
  }

  function handlePointerDown(e: React.PointerEvent, obj: CanvasObject) {
    e.stopPropagation()
    e.preventDefault()
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
    if (resizeRef.current) {
      e.preventDefault()
      const resize = resizeRef.current
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return
      const pointerXStitch = (e.clientX - svgRect.left) / cell
      const result = computeResizeFromHandle({
        handle: resize.handle,
        anchorXStitch: resize.anchorXStitch,
        anchorYStitch: resize.anchorYStitch,
        pointerXStitch,
        baseWidth: resize.baseWidth,
        baseHeight: resize.baseHeight,
        maxScale: MAX_OBJECT_SCALE,
      })
      setResizePreview({ id: resize.id, ...result })
      return
    }

    const drag = dragRef.current
    if (!drag) return
    e.preventDefault()
    const deltaX = Math.round((e.clientX - drag.startPointerX) / cell)
    const deltaY = Math.round((e.clientY - drag.startPointerY) / cell)
    const nextX = Math.min(Math.max(0, drag.startObjX + deltaX), drag.maxX)
    const nextY = Math.min(Math.max(0, drag.startObjY + deltaY), drag.maxY)
    setDragPreview({ id: drag.id, x: nextX, y: nextY })
  }

  function handlePointerUp() {
    if (resizeRef.current && resizePreview) {
      onResize(resizeRef.current.id, resizePreview)
    }
    resizeRef.current = null
    setResizePreview(null)

    const drag = dragRef.current
    if (drag && dragPreview) {
      onMove(drag.id, dragPreview.x, dragPreview.y)
    }
    dragRef.current = null
    setDragPreview(null)
  }

  function handleResizePointerDown(e: React.PointerEvent, obj: CanvasObject, handle: CornerHandle) {
    e.stopPropagation()
    e.preventDefault()
    onSelect(obj.id)
    const { width, height } = measureObject(obj)
    const { width: baseWidth, height: baseHeight } = measureObject({ ...obj, scale: 1 })

    const isWestAnchor = handle === 'ne' || handle === 'se'
    const isNorthAnchor = handle === 'sw' || handle === 'se'
    const anchorXStitch = isWestAnchor ? obj.x : obj.x + width
    const anchorYStitch = isNorthAnchor ? obj.y : obj.y + height

    resizeRef.current = { id: obj.id, handle, anchorXStitch, anchorYStitch, baseWidth, baseHeight }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  return (
    <svg
      ref={svgRef}
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
          const effectiveObj =
            obj.id === resizePreview?.id
              ? { ...obj, scale: resizePreview.scale, x: resizePreview.x, y: resizePreview.y }
              : obj.id === dragPreview?.id
                ? { ...obj, x: dragPreview.x, y: dragPreview.y }
                : obj
          const cells = renderObjectCells(effectiveObj)
          const isSelected = obj.id === selectedId
          const { width: hitWidth, height: hitHeight } = measureObject(effectiveObj)
          return (
            <g
              key={obj.id}
              className={isSelected ? 'canvas-object canvas-object--selected' : 'canvas-object'}
              onPointerDown={(e) => handlePointerDown(e, obj)}
            >
              {/* Invisible hit target covering the object's full bounding box, not just
                  its filled pixels — a touch landing in the gap inside a heart's notch or
                  a crescent moon's curve would otherwise miss every rect here, fall through
                  to the canvas background, and the browser would scroll instead of drag. */}
              <rect
                x={effectiveObj.x * cell}
                y={effectiveObj.y * cell}
                width={hitWidth * cell}
                height={hitHeight * cell}
                fill="transparent"
              />
              {cells.map((c, i) => (
                <rect
                  key={i}
                  x={(effectiveObj.x + c.dx) * cell}
                  y={(effectiveObj.y + c.dy) * cell}
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
      {(() => {
        const selected = objects.find((o) => o.id === selectedId)
        if (!selected) return null
        const effectiveObj =
          selected.id === resizePreview?.id
            ? { ...selected, scale: resizePreview.scale, x: resizePreview.x, y: resizePreview.y }
            : selected.id === dragPreview?.id
              ? { ...selected, x: dragPreview.x, y: dragPreview.y }
              : selected
        const { width, height } = measureObject(effectiveObj)
        const boxX = effectiveObj.x * cell
        const boxY = effectiveObj.y * cell
        const boxW = width * cell
        const boxH = height * cell
        const corners: Record<CornerHandle, { cx: number; cy: number }> = {
          nw: { cx: boxX, cy: boxY },
          ne: { cx: boxX + boxW, cy: boxY },
          sw: { cx: boxX, cy: boxY + boxH },
          se: { cx: boxX + boxW, cy: boxY + boxH },
        }
        return (
          <g className="selection-overlay">
            <rect
              x={boxX}
              y={boxY}
              width={boxW}
              height={boxH}
              fill="none"
              stroke="#646cff"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
            {CORNER_HANDLES.map((handle) => (
              <rect
                key={handle}
                x={corners[handle].cx - HANDLE_SIZE / 2}
                y={corners[handle].cy - HANDLE_SIZE / 2}
                width={HANDLE_SIZE}
                height={HANDLE_SIZE}
                className={`resize-handle resize-handle--${handle}`}
                onPointerDown={(e) => handleResizePointerDown(e, selected, handle)}
              />
            ))}
          </g>
        )
      })()}
    </svg>
  )
}
