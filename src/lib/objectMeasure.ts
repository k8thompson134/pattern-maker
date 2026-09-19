import type { CanvasObject } from './types'
import { getFont } from './fonts'
import { measureText } from './textRender'
import { getIcon } from './icons'
import { measureIcon } from './iconRender'

export function measureObject(obj: CanvasObject): { width: number; height: number } {
  if (obj.kind === 'text') {
    return measureText(obj.content, getFont(obj.font), obj.direction, obj.scale)
  }
  return measureIcon(getIcon(obj.iconId), obj.scale)
}

export function clampToCanvas<T extends CanvasObject>(
  obj: T,
  canvasWidth: number,
  canvasHeight: number,
): T {
  const { width, height } = measureObject(obj)
  const maxX = Math.max(0, canvasWidth - width)
  const maxY = Math.max(0, canvasHeight - height)
  return { ...obj, x: Math.min(Math.max(0, obj.x), maxX), y: Math.min(Math.max(0, obj.y), maxY) }
}
