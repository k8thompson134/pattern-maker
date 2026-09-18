import type { CanvasObject } from '../lib/types'
import { getFont } from '../lib/fonts'
import { renderTextToCells } from '../lib/textRender'

type CanvasGridProps = {
  widthStitches: number
  heightStitches: number
  zoom: number
  objects: CanvasObject[]
}

const CELL_SIZE = 16

export function CanvasGrid({ widthStitches, heightStitches, zoom, objects }: CanvasGridProps) {
  const cell = CELL_SIZE * zoom
  const pixelWidth = widthStitches * cell
  const pixelHeight = heightStitches * cell

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

  return (
    <svg
      className="canvas-grid"
      width={pixelWidth}
      height={pixelHeight}
      viewBox={`0 0 ${pixelWidth} ${pixelHeight}`}
    >
      <rect x={0} y={0} width={pixelWidth} height={pixelHeight} className="canvas-grid__bg" />
      <g className="canvas-grid__objects">
        {objects.map((obj) => {
          if (obj.kind !== 'text') return null
          const font = getFont(obj.font)
          const cells = renderTextToCells(obj.content, font)
          return (
            <g key={obj.id}>
              {cells.map((c, i) => (
                <rect
                  key={i}
                  x={(obj.x + c.dx) * cell}
                  y={(obj.y + c.dy) * cell}
                  width={cell}
                  height={cell}
                  fill={obj.color.hex}
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
