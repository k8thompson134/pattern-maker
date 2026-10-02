import { createId } from './id'

export type StitchColor = {
  dmcCode: string
  name: string
  hex: string
}

export type TextDirection = 'horizontal' | 'vertical'

export type TextObject = {
  id: string
  kind: 'text'
  groupId?: string
  content: string
  font: string
  direction: TextDirection
  scale: number
  x: number
  y: number
  rotation: number
  // Mirroring is applied after rotation, in screen space.
  mirrorH?: boolean
  mirrorV?: boolean
  color: StitchColor
}

export type IconObject = {
  id: string
  kind: 'icon'
  groupId?: string
  iconId: string
  scale: number
  x: number
  y: number
  rotation: number
  mirrorH?: boolean
  mirrorV?: boolean
  color: StitchColor
  color2?: StitchColor
}

export type PixelCell = { dx: number; dy: number; color: StitchColor }

export type BorderSides = {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

export type BorderMargins = {
  top: number
  bottom: number
  left: number
  right: number
}

export type BorderMetadata = {
  borderId: string
  margins: BorderMargins
  sides: BorderSides
  mainColor: StitchColor
  accentColor: StitchColor
}

export type PixelObject = {
  id: string
  kind: 'pixels'
  groupId?: string
  // Only the stitches themselves take taps, not the empty space inside the bounding box (used by borders).
  hollow?: boolean
  borderMeta?: BorderMetadata
  x: number
  y: number
  cells: PixelCell[]
}

export type CanvasObject = TextObject | IconObject | PixelObject

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
  zoom: number
  updatedAt: string
}

export const DEFAULT_FABRIC: FabricCount = {
  count: 22,
  stitchesPerInch: 11,
}

export function createEmptyProject(name: string): Project {
  return {
    id: createId(),
    name,
    widthStitches: 60,
    heightStitches: 60,
    fabric: DEFAULT_FABRIC,
    objects: [],
    zoom: 1,
    updatedAt: new Date().toISOString(),
  }
}
