import { useRef, useState } from 'react'
import type { CanvasObject, IconObject, TextObject } from '../lib/types'
import { renderObjectCells } from '../lib/objectCells'
import { cellColor } from '../lib/iconColors'
import { measureObject, MAX_OBJECT_SCALE } from '../lib/objectMeasure'
import { computeResizeFromHandle, type CornerHandle } from '../lib/resizeHandle'
import { nextSelection, objectsIntersectingBox, selectionBounds, type Bounds } from '../lib/selection'
import { symbolTextIsBlack } from '../lib/chartLayout'
import { createId } from '../lib/id'
import { inkBounds, inkUnionBounds } from '../lib/inkBounds'
import { guideTargets, snapMove } from '../lib/snap'
import { expandByBrush, floodFillCells, lineCells, rectangleCells, straightLineCells, type GridCell } from '../lib/pixelObject'
import type { StitchColor } from '../lib/types'

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
  drawShape?: 'free' | 'line' | 'rect' | 'fill'
  drawBrushSize?: number
  drawColor?: StitchColor
  eyedropperActive?: boolean
  onPickColor?: (color: StitchColor) => void
  onPaintCells: (cells: GridCell[], strokeId: string) => void
  onEraseCells: (cells: GridCell[], strokeId: string) => void
  stampMode: boolean
  onStamp: (gx: number, gy: number) => void
  symbols: Map<string, string>
  showSymbols: boolean
  snapEnabled: boolean
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
  drawShape,
  drawBrushSize = 1,
  drawColor,
  eyedropperActive,
  onPickColor,
  onPaintCells,
  onEraseCells,
  stampMode,
  onStamp,
  symbols,
  showSymbols,
  snapEnabled,
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
    ink: Bounds
    targetsX: number[]
    targetsY: number[]
  } | null>(null)

  // Live drag/resize state lives here, not in the parent's saved project — committing
  // every pixel of movement up to the parent triggers a localStorage write on every
  // pointermove event, which is what was making dragging feel laggy. Only the final
  // position/scale gets committed (and saved) on pointer-up.
  const [dragPreview, setDragPreview] = useState<{ ids: string[]; dx: number; dy: number; guidesX: number[]; guidesY: number[] } | null>(null)

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

  const marqueeRef = useRef<{ startX: number; startY: number; additive: boolean } | null>(null)
  const [marqueeBox, setMarqueeBox] = useState<Bounds | null>(null)

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
    const moving = objects.filter((o) => ids.includes(o.id))
    const others = objects.filter((o) => !ids.includes(o.id) && !(o.kind === 'pixels' && o.hollow)).map(inkBounds)
    dragRef.current = {
      ids,
      ink: inkUnionBounds(moving) ?? bounds,
      targetsX: guideTargets(widthStitches, others, 'x'),
      targetsY: guideTargets(heightStitches, others, 'y'),
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

    if (marqueeRef.current) {
      e.preventDefault()
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return
      const curX = Math.round((e.clientX - svgRect.left) / cell)
      const curY = Math.round((e.clientY - svgRect.top) / cell)
      const minX = Math.max(0, Math.min(marqueeRef.current.startX, curX))
      const maxX = Math.min(widthStitches, Math.max(marqueeRef.current.startX, curX))
      const minY = Math.max(0, Math.min(marqueeRef.current.startY, curY))
      const maxY = Math.min(heightStitches, Math.max(marqueeRef.current.startY, curY))
      setMarqueeBox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
      return
    }

    const drag = dragRef.current
    if (!drag) return
    e.preventDefault()
    const deltaX = Math.round((e.clientX - drag.startPointerX) / cell)
    const deltaY = Math.round((e.clientY - drag.startPointerY) / cell)
    const dx = Math.min(Math.max(drag.minDx, deltaX), drag.maxDx)
    const dy = Math.min(Math.max(drag.minDy, deltaY), drag.maxDy)
    const snapped = snapMove(drag.ink, drag.targetsX, drag.targetsY, dx, dy, drag, snapEnabled && !e.altKey)
    setDragPreview({ ids: drag.ids, ...snapped })
  }

  function handlePointerUp() {
    if (marqueeRef.current) {
      if (marqueeBox && (marqueeBox.width > 0 || marqueeBox.height > 0)) {
        const hit = objectsIntersectingBox(marqueeBox, objects)
        if (marqueeRef.current.additive) {
          const combined = Array.from(new Set([...selectedIds, ...hit]))
          onSelectionChange(combined)
        } else {
          onSelectionChange(hit)
        }
      } else if (!marqueeRef.current.additive) {
        onSelectionChange([])
      }
      marqueeRef.current = null
      setMarqueeBox(null)
    }

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

  const [linePreview, setLinePreview] = useState<{ start: GridCell; current: GridCell; cells: GridCell[] } | null>(null)
  const lineStartRef = useRef<{ start: GridCell; strokeId: string; shiftKey: boolean } | null>(null)
  const strokeRef = useRef<{ id: string; last: GridCell } | null>(null)

  function drawCellAt(e: React.PointerEvent): GridCell | null {
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return null
    return { gx: Math.floor((e.clientX - svgRect.left) / cell), gy: Math.floor((e.clientY - svgRect.top) / cell) }
  }

  function isErasing(e?: { altKey?: boolean }): boolean {
    return drawErase || Boolean(e?.altKey)
  }

  function applyStroke(cells: GridCell[], strokeId: string, e?: { altKey?: boolean }) {
    const expanded = expandByBrush(cells, drawBrushSize)
    const onCanvas = expanded.filter((c) => c.gx >= 0 && c.gy >= 0 && c.gx < widthStitches && c.gy < heightStitches)
    if (onCanvas.length === 0) return
    if (isErasing(e)) onEraseCells(onCanvas, strokeId)
    else onPaintCells(onCanvas, strokeId)
  }

  function handleDrawPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const at = drawCellAt(e)
    if (!at) return
    e.currentTarget.setPointerCapture(e.pointerId)

    // Pipette / Eyedropper mode:
    if (eyedropperActive) {
      // Find color at clicked cell
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i]
        if (obj.kind === 'pixels') {
          const matching = obj.cells.find((c) => obj.x + c.dx === at.gx && obj.y + c.dy === at.gy)
          if (matching) {
            onPickColor?.(matching.color)
            return
          }
        } else {
          const cells = renderObjectCells(obj)
          const matching = cells.find((c) => obj.x + c.dx === at.gx && obj.y + c.dy === at.gy)
          if (matching) {
            onPickColor?.(cellColor(obj, matching))
            return
          }
        }
      }
      return
    }

    if (drawShape === 'fill') {
      // Flood fill from the tapped cell:
      // Build a fast lookup map of colors across all existing objects
      const occupied = new Map<string, string>()
      for (const obj of objects) {
        if (obj.kind === 'pixels') {
          for (const c of obj.cells) {
            occupied.set(`${obj.x + c.dx},${obj.y + c.dy}`, c.color.dmcCode)
          }
        } else {
          for (const c of renderObjectCells(obj)) {
            occupied.set(`${obj.x + c.dx},${obj.y + c.dy}`, cellColor(obj, c).dmcCode)
          }
        }
      }
      const colorAt = (gx: number, gy: number) => occupied.get(`${gx},${gy}`) ?? null
      const filledCells = floodFillCells(at, widthStitches, heightStitches, colorAt)
      if (filledCells.length > 0) {
        const strokeId = createId()
        if (isErasing(e)) onEraseCells(filledCells, strokeId)
        else onPaintCells(filledCells, strokeId)
      }
      return
    }

    const isBox = drawShape === 'rect'
    const isLine = drawShape === 'line' || e.shiftKey
    if (isBox || isLine) {
      const strokeId = createId()
      lineStartRef.current = { start: at, strokeId, shiftKey: e.shiftKey }
      const cells = isBox ? rectangleCells(at, at) : expandByBrush([at], drawBrushSize)
      setLinePreview({ start: at, current: at, cells })
    } else {
      strokeRef.current = { id: createId(), last: at }
      applyStroke([at], strokeRef.current.id, e)
    }
  }

  function handleDrawPointerMove(e: React.PointerEvent) {
    const at = drawCellAt(e)
    if (!at) return

    if (lineStartRef.current) {
      e.preventDefault()
      const start = lineStartRef.current.start
      if (drawShape === 'rect') {
        const cells = rectangleCells(start, at)
        setLinePreview({ start, current: at, cells })
      } else {
        // If Shift was pressed or is currently pressed, snap to 0/45/90 degrees
        const snap = lineStartRef.current.shiftKey || e.shiftKey
        const path = straightLineCells(start, at, snap)
        const cells = expandByBrush(path, drawBrushSize)
        setLinePreview({ start, current: at, cells })
      }
      return
    }

    const stroke = strokeRef.current
    if (!stroke || (at.gx === stroke.last.gx && at.gy === stroke.last.gy)) return
    applyStroke(lineCells(stroke.last, at).slice(1), stroke.id, e)
    stroke.last = at
  }

  function handleDrawPointerEnd(e: React.PointerEvent) {
    if (lineStartRef.current) {
      const { start, strokeId, shiftKey } = lineStartRef.current
      const at = drawCellAt(e) ?? (linePreview ? linePreview.current : start)
      if (drawShape === 'rect') {
        const cells = rectangleCells(start, at)
        const onCanvas = cells.filter((c) => c.gx >= 0 && c.gy >= 0 && c.gx < widthStitches && c.gy < heightStitches)
        if (onCanvas.length > 0) {
          if (isErasing(e)) onEraseCells(onCanvas, strokeId)
          else onPaintCells(onCanvas, strokeId)
        }
      } else {
        const snap = shiftKey || e.shiftKey
        const path = straightLineCells(start, at, snap)
        applyStroke(path, strokeId, e)
      }
      lineStartRef.current = null
      setLinePreview(null)
    }
    strokeRef.current = null
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
        onPointerDown={(e) => {
          if (drawMode || stampMode) return
          const svgRect = svgRef.current?.getBoundingClientRect()
          if (!svgRect) return
          const startX = Math.round((e.clientX - svgRect.left) / cell)
          const startY = Math.round((e.clientY - svgRect.top) / cell)
          const additive = multiSelect || e.shiftKey
          marqueeRef.current = { startX, startY, additive }
          setMarqueeBox({ x: startX, y: startY, width: 0, height: 0 })
          ;(e.target as Element).setPointerCapture(e.pointerId)
        }}
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
      {dragPreview && (
        <g className="snap-guides" pointerEvents="none">
          {dragPreview.guidesX.map((gx) => (
            <line key={`gx${gx}`} x1={gx * cell} y1={0} x2={gx * cell} y2={pixelHeight} />
          ))}
          {dragPreview.guidesY.map((gy) => (
            <line key={`gy${gy}`} x1={0} y1={gy * cell} x2={pixelWidth} y2={gy * cell} />
          ))}
        </g>
      )}
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
      {marqueeBox && (marqueeBox.width > 0 || marqueeBox.height > 0) && (
        <rect
          x={marqueeBox.x * cell}
          y={marqueeBox.y * cell}
          width={marqueeBox.width * cell}
          height={marqueeBox.height * cell}
          fill="rgba(100, 108, 255, 0.15)"
          stroke="#646cff"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          pointerEvents="none"
        />
      )}
      {drawMode && (
        <>
          {linePreview && (
            <g className="draw-line-preview" pointerEvents="none">
              {linePreview.cells.map((c, i) =>
                stitchRect(
                  i,
                  c.gx,
                  c.gy,
                  drawErase ? { hex: '#ff4444', dmcCode: 'erase' } : (drawColor ?? { hex: '#310', dmcCode: '310' }),
                  false,
                ),
              )}
              {/* Optional thin rubber-band stroke connecting centers for visual guidance */}
              {drawShape === 'rect' ? (
                <rect
                  x={Math.min(linePreview.start.gx, linePreview.current.gx) * cell}
                  y={Math.min(linePreview.start.gy, linePreview.current.gy) * cell}
                  width={(Math.abs(linePreview.current.gx - linePreview.start.gx) + 1) * cell}
                  height={(Math.abs(linePreview.current.gy - linePreview.start.gy) + 1) * cell}
                  fill="none"
                  stroke={drawErase ? '#ff4444' : '#646cff'}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              ) : (
                <line
                  x1={linePreview.start.gx * cell + cell / 2}
                  y1={linePreview.start.gy * cell + cell / 2}
                  x2={linePreview.current.gx * cell + cell / 2}
                  y2={linePreview.current.gy * cell + cell / 2}
                  stroke={drawErase ? '#ff4444' : '#646cff'}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  opacity={0.8}
                />
              )}
            </g>
          )}
          <rect
            x={0}
            y={0}
            width={pixelWidth}
            height={pixelHeight}
            fill="transparent"
            className={`draw-overlay draw-overlay--${eyedropperActive ? 'pipette' : drawShape || 'free'}`}
            onPointerDown={handleDrawPointerDown}
            onPointerMove={handleDrawPointerMove}
            onPointerUp={handleDrawPointerEnd}
            onPointerCancel={handleDrawPointerEnd}
          />
        </>
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
