type CanvasGridProps = {
  widthStitches: number
  heightStitches: number
  zoom: number
}

const CELL_SIZE = 16

export function CanvasGrid({ widthStitches, heightStitches, zoom }: CanvasGridProps) {
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
      <g className="canvas-grid__lines">{lines}</g>
    </svg>
  )
}
