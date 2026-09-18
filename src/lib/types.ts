export type StitchColor = {
  dmcCode: string
  name: string
  hex: string
}

export type TextDirection = 'horizontal' | 'vertical'

export type TextObject = {
  id: string
  kind: 'text'
  content: string
  font: string
  direction: TextDirection
  scale: number
  x: number
  y: number
  color: StitchColor
}

export type IconObject = {
  id: string
  kind: 'icon'
  iconId: string
  x: number
  y: number
  width: number
  height: number
  color: StitchColor
}

export type CanvasObject = TextObject | IconObject

export type FabricCount = {
  count: number
  stitchesPerInch: number
}

export type Project = {
  id: string
  name: string
  widthStitches: number
  heightStitches: number
  fabric: FabricCount
  objects: CanvasObject[]
  palette: StitchColor[]
  zoom: number
  updatedAt: string
}

export const DEFAULT_FABRIC: FabricCount = {
  count: 22,
  stitchesPerInch: 11,
}

export function createEmptyProject(name: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    widthStitches: 60,
    heightStitches: 60,
    fabric: DEFAULT_FABRIC,
    objects: [],
    palette: [],
    zoom: 1,
    updatedAt: new Date().toISOString(),
  }
}
