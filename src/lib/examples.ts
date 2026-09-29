import { BORDERS, buildBorder } from './borders'
import { byCode, newIconColors } from './iconColors'
import { getIcon } from './icons'
import { createId } from './id'
import { measureObject } from './objectMeasure'
import { DEFAULT_FABRIC } from './types'
import type { CanvasObject, IconObject, Project, TextObject } from './types'

const WIDTH = 60
const HEIGHT = 52

function centeredX(obj: CanvasObject, width: number): number {
  return Math.floor((width - measureObject(obj).width) / 2)
}

function textLine(content: string, y: number, width = WIDTH, font = 'tiny-3x5', colorCode = '3799', scale = 1): TextObject {
  const line: TextObject = {
    id: createId(),
    kind: 'text',
    content,
    font,
    direction: 'horizontal',
    scale,
    x: 0,
    y,
    rotation: 0,
    color: byCode(colorCode),
  }
  return { ...line, x: centeredX(line, width) }
}

function centeredRow(icons: IconObject[], width: number, gap: number): void {
  const total = icons.reduce((sum, o) => sum + measureObject(o).width, 0) + gap * (icons.length - 1)
  let x = Math.floor((width - total) / 2)
  for (const o of icons) {
    o.x = x
    x += measureObject(o).width + gap
  }
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

export function buildGardenExample(zoom: number): Project {
  const width = 68
  const height = 66
  const vine = BORDERS.find((b) => b.id === 'vine')!
  const border = buildBorder(vine, width, height, 0, byCode(vine.main), byCode(vine.accent))!

  const flowers = ['tulip', 'daisy', 'sunflower', 'lavender'].map((id) => icon(id, 0, 35))
  centeredRow(flowers, width, 4)
  const critters = ['ladybug', 'butterfly-spotted', 'bee-striped'].map((id) => icon(id, 0, 51))
  centeredRow(critters, width, 6)

  return {
    id: createId(),
    name: 'Garden sampler',
    widthStitches: width,
    heightStitches: height,
    fabric: DEFAULT_FABRIC,
    objects: [
      border,
      textLine('my garden', 10, width, 'mixed-5x9', '701'),
      ...flowers,
      ...critters,
      textLine('GROW SLOWLY', 56, width, 'tiny-3x5', '3799'),
    ],
    zoom,
    updatedAt: new Date().toISOString(),
  }
}

export function buildWelcomeExample(zoom: number): Project {
  const width = 60
  const height = 64
  const scallop = BORDERS.find((b) => b.id === 'scallop')!
  const border = buildBorder(scallop, width, height, 0, byCode(scallop.main), byCode(scallop.accent))!

  const sky = [
    { ...icon('moon', 0, 31), color: byCode('726') },
    { ...icon('star', 0, 31), color: byCode('3607') },
    { ...icon('cloud', 0, 31), color: byCode('798') },
  ]
  centeredRow(sky, width, 5)

  return {
    id: createId(),
    name: 'Birth announcement',
    widthStitches: width,
    heightStitches: height,
    fabric: DEFAULT_FABRIC,
    objects: [
      border,
      textLine('welcome', 10, width, 'mixed-5x9', '798'),
      ...sky,
      textLine('Ava June', 36, width, 'mixed-5x9', '310'),
      textLine('MARCH 14 2027', 50, width, 'tiny-3x5', '3799'),
    ],
    zoom,
    updatedAt: new Date().toISOString(),
  }
}

export const EXAMPLES = [
  { id: 'cozy', name: 'Cozy corner', build: buildCozyExample },
  { id: 'garden', name: 'Garden sampler', build: buildGardenExample },
  { id: 'welcome', name: 'Birth announcement', build: buildWelcomeExample },
]
