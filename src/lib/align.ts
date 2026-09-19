import type { CanvasObject } from './types'
import { clampToCanvas, measureObject } from './objectMeasure'

export type Alignment = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'

export function alignObject<T extends CanvasObject>(
  obj: T,
  canvasWidth: number,
  canvasHeight: number,
  alignment: Alignment,
): T {
  const { width, height } = measureObject(obj)
  let next: T = obj

  switch (alignment) {
    case 'left':
      next = { ...obj, x: 0 }
      break
    case 'center-h':
      next = { ...obj, x: Math.floor((canvasWidth - width) / 2) }
      break
    case 'right':
      next = { ...obj, x: canvasWidth - width }
      break
    case 'top':
      next = { ...obj, y: 0 }
      break
    case 'center-v':
      next = { ...obj, y: Math.floor((canvasHeight - height) / 2) }
      break
    case 'bottom':
      next = { ...obj, y: canvasHeight - height }
      break
  }

  return clampToCanvas(next, canvasWidth, canvasHeight)
}
