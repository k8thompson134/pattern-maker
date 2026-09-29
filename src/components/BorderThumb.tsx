import type { BorderDef } from '../lib/borders'

type BorderThumbProps = {
  border: BorderDef
  color: string
  accentColor: string
  pixelSize?: number
  length?: number
}

export function BorderThumb({ border, color, accentColor, pixelSize = 3, length = 30 }: BorderThumbProps) {
  const p = border.rows[0].length
  const t = border.rows.length
  const width = length * pixelSize
  const height = t * pixelSize

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {border.rows.map((row, y) =>
        Array.from({ length }, (_, x) => {
          const bit = row[x % p]
          return bit === '1' || bit === '2' ? (
            <rect
              key={`${x}-${y}`}
              x={x * pixelSize}
              y={y * pixelSize}
              width={pixelSize}
              height={pixelSize}
              fill={bit === '2' ? accentColor : color}
            />
          ) : null
        }),
      )}
    </svg>
  )
}
