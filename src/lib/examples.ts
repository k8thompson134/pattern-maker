import { BORDERS, buildBorder } from './borders'
import { byCode, newIconColors } from './iconColors'
import { getIcon } from './icons'
import { createId } from './id'
import { measureObject } from './objectMeasure'
import { DEFAULT_FABRIC } from './types'
import type { CanvasObject, IconObject, Project, TextObject } from './types'

const WIDTH = 60
const HEIGHT = 52

function centeredX(obj: CanvasObject): number {
  return Math.floor((WIDTH - measureObject(obj).width) / 2)
}

function textLine(content: string, y: number): TextObject {
  const line: TextObject = {
    id: createId(),
    kind: 'text',
    content,
    font: 'tiny-3x5',
    direction: 'horizontal',
    scale: 1,
    x: 0,
    y,
    rotation: 0,
    color: byCode('3799'),
  }
  return { ...line, x: centeredX(line) }
}

function icon(iconId: string, x: number, bottom: number): IconObject {
  const def = getIcon(iconId)
  return {
    id: createId(),
    kind: 'icon',
    iconId,
    scale: 1,
    x,
    y: bottom - def.height,
    rotation: 0,
    ...newIconColors(def, byCode('310')),
  }
}

export function buildCozyExample(zoom: number): Project {
  const hearts = BORDERS.find((b) => b.id === 'hearts')!
  const border = buildBorder(hearts, WIDTH, HEIGHT, 0, byCode(hearts.main), byCode(hearts.accent))!

  const mug = { ...icon('steaming-mug', 0, 37), color: byCode('3607') }
  const cottage = icon('cottage', 0, 37)
  const boba = icon('boba', 0, 37)
  const gap = 4
  const total = [mug, cottage, boba].reduce((sum, o) => sum + measureObject(o).width, 0) + 2 * gap
  let x = Math.floor((WIDTH - total) / 2)
  for (const o of [mug, cottage, boba]) {
    o.x = x
    x += measureObject(o).width + gap
  }

  const stamps: IconObject[] = ['mini-heart', 'mini-star', 'mini-heart', 'mini-star', 'mini-heart', 'mini-star'].map(
    (iconId, i) => ({
      ...icon(iconId, Math.floor((WIDTH - 45) / 2) + i * 8, 45),
      color: byCode(i % 2 === 0 ? '666' : '726'),
    }),
  )

  return {
    id: createId(),
    name: 'Cozy corner',
    widthStitches: WIDTH,
    heightStitches: HEIGHT,
    fabric: DEFAULT_FABRIC,
    objects: [border, textLine('HOME IS WHERE', 7), textLine('THE TEA IS', 14), mug, cottage, boba, ...stamps],
    zoom,
    updatedAt: new Date().toISOString(),
  }
}
