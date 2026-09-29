import { useRef, useState } from 'react'
import type { CanvasObject, IconObject, TextObject } from '../lib/types'
import { renderObjectCells } from '../lib/objectCells'
import { cellColor } from '../lib/iconColors'
import { measureObject, MAX_OBJECT_SCALE } from '../lib/objectMeasure'
import { computeResizeFromHandle, type CornerHandle } from '../lib/resizeHandle'
import { nextSelection, selectionBounds } from '../lib/selection'
import { symbolTextIsBlack } from '../lib/chartLayout'

type CanvasGridProps = {
  widthStitches: number
  heightStitches: number
  zoom: number
  objects: CanvasObject[]
  selectedIds: string[]
  multiSelect: boolean
  onSelectionChange: (ids: string[]) => void
  onMoveSelection: (ids: string[], dx: number, dy: number) => void
  onResize: (id: string, patch: { scale: number; x: number; y: number }) => void
  drawMode: boolean
  drawErase: boolean
  onPaintCell: (gx: number, gy: number) => void
  onEraseCell: (gx: number, gy: number) => void
  stampMode: boolean
  onStamp: (gx: number, gy: number) => void
  symbols: Map<string, string>
  showSymbols: boolean
}

export const CELL_SIZE = 16
const HANDLE_SIZE = 24
const HANDLE_VISIBLE_SIZE = 12

const CORNER_HANDLES: CornerHandle[] = ['nw', 'ne', 'sw', 'se']

export function CanvasGrid({
  widthStitches,
  heightStitches,
  zoom,
  objects,
  selectedIds,
  multiSelect,
  onSelectionChange,
  onMoveSelection,
  onResize,
  drawMode,
  drawErase,
  onPaintCell,
  onEraseCell,
  stampMode,
  onStamp,
  symbols,
  showSymbols,
}: CanvasGridProps) {
  const cell = CELL_SIZE * zoom
  const pixelWidth = widthStitches * cell
  const pixelHeight = heightStitches * cell
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drawSymbols = showSymbols && cell >= 8

  function stitchRect(key: number, x: number, y: number, color: { hex: string; dmcCode: string }, isSelected: boolean) {
    return (
      <g key={key}>
        <rect
          x={x * cell}
          y={y * cell}
          width={cell}
          height={cell}
          fill={color.hex}
          stroke={isSelected ? '#646cff' : undefined}
          strokeWidth={isSelected ? 1 : undefined}
        />
        {drawSymbols && (
          <text
            x={x * cell + cell / 2}
            y={y * cell + cell / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={cell * (symbols.get(color.dmcCode)?.length === 2 ? 0.45 : 0.65)}
            fill={symbolTextIsBlack(color.hex) ? '#000' : '#fff'}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {symbols.get(color.dmcCode)}
          </text>
        )}
      </g>
    )
  }

  const dragRef = useRef<{
    ids: string[]
    startPointerX: number
    startPointerY: number
    minDx: number
    maxDx: number
    minDy: number
    maxDy: number
  } | null>(null)

  // Live drag/resize state lives here, not in the parent's saved project — committing
  // every pixel of movement up to the parent triggers a localStorage write on every
  // pointermove event, which is what was making dragging feel laggy. Only the final
  // position/scale gets committed (and saved) on pointer-up.
  const [dragPreview, setDragPreview] = useState<{ ids: string[]; dx: number; dy: number } | null>(null)

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

  function withPreview(obj: CanvasObject): CanvasObject {
    if (obj.id === resizePreview?.id && obj.kind !== 'pixels') {
      return { ...obj, scale: resizePreview.scale, x: resizePreview.x, y: resizePreview.y }
    }
    if (dragPreview?.ids.includes(obj.id)) {
      return { ...obj, x: obj.x + dragPreview.dx, y: obj.y + dragPreview.dy }
    }
    return obj
  }

  const lines: React.ReactNode[] = []
  for (let x = 0; x <= widthStitches; x++) {
    lines.push(<line key={`v${x}`} className={x % 10 === 0 ? 'major' : undefined} x1={x * cell} y1={0} x2={x * cell} y2={pixelHeight} />)
  }
  for (let y = 0; y <= heightStitches; y++) {
    lines.push(<line key={`h${y}`} className={y % 10 === 0 ? 'major' : undefined} x1={0} y1={y * cell} x2={pixelWidth} y2={y * cell} />)
  }

  function handlePointerDown(e: React.PointerEvent, obj: CanvasObject) {
    e.stopPropagation()
    e.preventDefault()
    const additive = multiSelect || e.shiftKey
    const ids = nextSelection(selectedIds, obj.id, additive, objects)
    onSelectionChange(ids)
    // Toggling an object out of an additive selection shouldn't start dragging the rest.
    if (!ids.includes(obj.id)) return
    const bounds = selectionBounds(objects.filter((o) => ids.includes(o.id)))
    if (!bounds) return
    dragRef.current = {
      ids,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      minDx: -bounds.x,
      maxDx: Math.max(0, widthStitches - bounds.width) - bounds.x,
      minDy: -bounds.y,
      maxDy: Math.max(0, heightStitches - bounds.height) - bounds.y,
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
    const dx = Math.min(Math.max(drag.minDx, deltaX), drag.maxDx)
    const dy = Math.min(Math.max(drag.minDy, deltaY), drag.maxDy)
    setDragPreview({ ids: drag.ids, dx, dy })
  }

  function handlePointerUp() {
    if (resizeRef.current && resizePreview) {
      onResize(resizeRef.current.id, resizePreview)
    }
    resizeRef.current = null
    setResizePreview(null)

    const drag = dragRef.current
    if (drag && dragPreview && (dragPreview.dx !== 0 || dragPreview.dy !== 0)) {
      onMoveSelection(drag.ids, dragPreview.dx, dragPreview.dy)
    }
    dragRef.current = null
    setDragPreview(null)
  }

  function handleResizePointerDown(e: React.PointerEvent, obj: TextObject | IconObject, handle: CornerHandle) {
    e.stopPropagation()
    e.preventDefault()
    const { width, height } = measureObject(obj)
    const { width: baseWidth, height: baseHeight } = measureObject({ ...obj, scale: 1 })

    const isWestAnchor = handle === 'ne' || handle === 'se'
    const isNorthAnchor = handle === 'sw' || handle === 'se'
    const anchorXStitch = isWestAnchor ? obj.x : obj.x + width
    const anchorYStitch = isNorthAnchor ? obj.y : obj.y + height

    resizeRef.current = { id: obj.id, handle, anchorXStitch, anchorYStitch, baseWidth, baseHeight }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function handleDrawPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const gx = Math.floor((e.clientX - svgRect.left) / cell)
    const gy = Math.floor((e.clientY - svgRect.top) / cell)
    if (drawErase) {
      onEraseCell(gx, gy)
    } else {
      onPaintCell(gx, gy)
    }
  }

  function handleStampPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const gx = Math.floor((e.clientX - svgRect.left) / cell)
    const gy = Math.floor((e.clientY - svgRect.top) / cell)
    onStamp(gx, gy)
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
        onPointerDown={() => onSelectionChange([])}
      />
      <g className="canvas-grid__objects">
        {objects.map((obj) => {
          const effectiveObj = withPreview(obj)
          const isSelected = selectedIds.includes(obj.id)
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
              {!(effectiveObj.kind === 'pixels' && effectiveObj.hollow) && (
                <rect
                  x={effectiveObj.x * cell}
                  y={effectiveObj.y * cell}
                  width={hitWidth * cell}
                  height={hitHeight * cell}
                  fill="transparent"
                />
              )}
              {effectiveObj.kind === 'pixels'
                ? effectiveObj.cells.map((c, i) =>
                    stitchRect(i, effectiveObj.x + c.dx, effectiveObj.y + c.dy, c.color, isSelected),
                  )
                : renderObjectCells(effectiveObj).map((c, i) =>
                    stitchRect(i, effectiveObj.x + c.dx, effectiveObj.y + c.dy, cellColor(effectiveObj, c), isSelected),
                  )}
            </g>
          )
        })}
      </g>
      <g className="canvas-grid__lines">{lines}</g>
      {(() => {
        const selected = objects.filter((o) => selectedIds.includes(o.id)).map(withPreview)
        const bounds = selectionBounds(selected)
        if (!bounds) return null
        // Corner-resize only applies to a single text/icon object.
        const effectiveObj = selected.length === 1 ? selected[0] : null
        const { width, height } = bounds
        const boxX = bounds.x * cell
        const boxY = bounds.y * cell
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
            {/* Pixel drawings scale by adding/removing individual stitches, not by a
                uniform NxN block factor, so corner-drag resize doesn't apply to them. */}
            {effectiveObj &&
              effectiveObj.kind !== 'pixels' &&
              CORNER_HANDLES.map((handle) => (
                // 24px invisible touch target (the touch-size fix from Known Issues)
                // with a smaller visible square, so handles don't hide small objects.
                <g key={handle}>
                  <rect
                    x={corners[handle].cx - HANDLE_SIZE / 2}
                    y={corners[handle].cy - HANDLE_SIZE / 2}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill="transparent"
                    className={`resize-handle-hit resize-handle--${handle}`}
                    onPointerDown={(e) => handleResizePointerDown(e, effectiveObj, handle)}
                  />
                  <rect
                    x={corners[handle].cx - HANDLE_VISIBLE_SIZE / 2}
                    y={corners[handle].cy - HANDLE_VISIBLE_SIZE / 2}
                    width={HANDLE_VISIBLE_SIZE}
                    height={HANDLE_VISIBLE_SIZE}
                    className="resize-handle"
                    pointerEvents="none"
                  />
                </g>
              ))}
          </g>
        )
      })()}
      {drawMode && (
        <rect
          x={0}
          y={0}
          width={pixelWidth}
          height={pixelHeight}
          fill="transparent"
          className="draw-overlay"
          onPointerDown={handleDrawPointerDown}
        />
      )}
      {stampMode && (
        <rect
          x={0}
          y={0}
          width={pixelWidth}
          height={pixelHeight}
          fill="transparent"
          className="draw-overlay"
          onPointerDown={handleStampPointerDown}
        />
      )}
    </svg>
  )
}
