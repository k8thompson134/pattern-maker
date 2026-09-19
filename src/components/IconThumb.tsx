import type { IconDef } from '../lib/icons'

type IconThumbProps = {
  icon: IconDef
  pixelSize?: number
  color?: string
}

export function IconThumb({ icon, pixelSize = 3, color = '#333' }: IconThumbProps) {
  const width = icon.width * pixelSize
  const height = icon.height * pixelSize

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {icon.rows.map((row, y) =>
        [...row].map((bit, x) =>
          bit === '1' ? (
            <rect
              key={`${x}-${y}`}
              x={x * pixelSize}
              y={y * pixelSize}
              width={pixelSize}
              height={pixelSize}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
