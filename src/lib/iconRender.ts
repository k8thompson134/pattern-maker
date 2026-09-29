import type { IconDef } from './icons'

import type { FilledCell } from './textRender'

export type { FilledCell }

export function renderIconToCells(icon: IconDef, scale = 1): FilledCell[] {
  const cells: FilledCell[] = []

  icon.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '1' && row[x] !== '2') continue
      const accent = row[x] === '2' ? true : undefined
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          cells.push(accent ? { dx: x * scale + sx, dy: y * scale + sy, accent } : { dx: x * scale + sx, dy: y * scale + sy })
        }
      }
    }
  })

  return cells
}

export function measureIcon(icon: IconDef, scale = 1): { width: number; height: number } {
  return { width: icon.width * scale, height: icon.height * scale }
}
