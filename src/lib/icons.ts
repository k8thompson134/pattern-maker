import { BOTANICAL_ICONS } from './iconsBotanical'
import { CARE_ICONS } from './iconsCare'
import { CELEBRATION_ICONS } from './iconsCelebration'
import { FANTASY_ICONS } from './iconsFantasy'
import { GREEK_ICONS } from './iconsGreek'
import { HOBBIES_ICONS } from './iconsHobbies'
import { PRIDE_ICONS } from './iconsPride'
import { SOLIDARITY_ICONS } from './iconsSolidarity'
import { SPOOKY_ICONS } from './iconsSpooky'

export type IconDef = {
  id: string
  name: string
  group?: string
  width: number
  height: number
  // '1' = main stitch, '2' = accent stitch (second color)
  rows: string[]
  // Default DMC codes applied when the icon is placed; accent falls back to black.
  main?: string
  accent?: string
}

const I = (rows: string[]) => rows

const CORE_ICONS: IconDef[] = [
  {
    id: 'heart',
    name: 'Heart',
    width: 8,
    height: 7,
    rows: I([
      '01100110',
      '11111111',
      '11111111',
      '11111111',
      '01111110',
      '00111100',
      '00011000',
    ]),
  },
  {
    id: 'star',
    name: 'Sparkle',
    width: 7,
    height: 7,
    rows: I([
      '0001000',
      '0001000',
      '0011100',
      '1111111',
      '0011100',
      '0001000',
      '0001000',
    ]),
  },
  {
    id: 'moon',
    name: 'Crescent Moon',
    width: 9,
    height: 9,
    rows: I([
      '000110000',
      '011100000',
      '011000000',
      '111000000',
      '111000000',
      '111000000',
      '011100000',
      '001111100',
      '000011100',
    ]),
  },
  {
    id: 'sun',
    name: 'Sun',
    width: 11,
    height: 11,
    rows: I([
      '00000100000',
      '01000100010',
      '00100000100',
      '00001110000',
      '00011111000',
      '11011111011',
      '00011111000',
      '00001110000',
      '00100000100',
      '01000100010',
      '00000100000',
    ]),
  },
  {
    id: 'cloud',
    name: 'Cloud',
    width: 11,
    height: 6,
    rows: I([
      '00011100000',
      '00111110110',
      '01111111111',
      '11111111111',
      '11111111111',
      '01111111110',
    ]),
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    width: 15,
    height: 7,
    rows: I([
      '000001111100000',
      '000111111111000',
      '001110000011100',
      '011101111101110',
      '011011000110110',
      '110110111011011',
      '110101101101011',
    ]),
  },
  {
    id: 'flower',
    name: 'Flower',
    width: 9,
    height: 9,
    rows: I([
      '000111000',
      '001111100',
      '111010111',
      '111101111',
      '111000111',
      '111101111',
      '111010111',
      '001111100',
      '000111000',
    ]),
  },
  {
    id: 'rose',
    name: 'Rose',
    width: 9,
    height: 13,
    rows: I([
      '001111100',
      '010000010',
      '101111101',
      '101000101',
      '101011101',
      '010100010',
      '001111100',
      '000010000',
      '011010000',
      '111010000',
      '001110110',
      '000011111',
      '000010000',
    ]),
  },
  {
    id: 'leaf',
    name: 'Leaf',
    width: 9,
    height: 9,
    rows: I([
      '000000111',
      '000011111',
      '000111011',
      '001110111',
      '011101111',
      '011011110',
      '010111100',
      '101111000',
      '100000000',
    ]),
  },
  {
    id: 'mushroom',
    name: 'Mushroom',
    width: 11,
    height: 9,
    rows: I([
      '00011111000',
      '01110111111',
      '11011111011',
      '11111011111',
      '11111111111',
      '00011111000',
      '00011111000',
      '00011111000',
      '00111111100',
    ]),
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    width: 9,
    height: 10,
    rows: I([
      '010111010',
      '001111100',
      '000000000',
      '011111110',
      '110111011',
      '111110111',
      '010111110',
      '001111010',
      '000111000',
      '000010000',
    ]),
  },
  {
    id: 'cherries',
    name: 'Cherries',
    width: 11,
    height: 9,
    rows: I([
      '00000001100',
      '00000011000',
      '00000101000',
      '00001000100',
      '00010000100',
      '01110001110',
      '11111011111',
      '11111011111',
      '01110001110',
    ]),
  },
  {
    id: 'ghost',
    name: 'Ghost',
    width: 9,
    height: 9,
    rows: I([
      '001111100',
      '011111110',
      '110111011',
      '110111011',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '101101101',
    ]),
  },
  {
    id: 'music-note',
    name: 'Music Note',
    width: 7,
    height: 11,
    rows: I([
      '0000110',
      '0000110',
      '0000110',
      '0000110',
      '0000110',
      '0000110',
      '0000110',
      '0111110',
      '1111100',
      '1111000',
      '0110000',
    ]),
  },
  {
    id: 'lightning',
    name: 'Lightning Bolt',
    width: 7,
    height: 9,
    rows: I([
      '0001110',
      '0001100',
      '0011000',
      '0110000',
      '1111111',
      '0000110',
      '0001100',
      '0011000',
      '0110000',
    ]),
  },
  {
    id: 'diamond',
    name: 'Diamond',
    width: 9,
    height: 9,
    rows: I([
      '000010000',
      '000111000',
      '001111100',
      '011111110',
      '111111111',
      '011111110',
      '001111100',
      '000111000',
      '000010000',
    ]),
  },
  {
    id: 'circle',
    name: 'Circle',
    width: 9,
    height: 9,
    rows: I([
      '001111100',
      '011111110',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '011111110',
      '001111100',
    ]),
  },
  {
    id: 'square',
    name: 'Square',
    width: 9,
    height: 9,
    rows: I([
      '111111111',
      '100000001',
      '100000001',
      '100000001',
      '100000001',
      '100000001',
      '100000001',
      '100000001',
      '111111111',
    ]),
  },
  {
    id: 'triangle',
    name: 'Triangle',
    width: 9,
    height: 8,
    rows: I([
      '000010000',
      '000111000',
      '001111100',
      '001111100',
      '011111110',
      '011111110',
      '111111111',
      '111111111',
    ]),
  },
  {
    id: 'arrow-up',
    name: 'Arrow',
    width: 9,
    height: 9,
    rows: I([
      '000010000',
      '000111000',
      '001111100',
      '011111110',
      '000010000',
      '000010000',
      '000010000',
      '000010000',
      '000010000',
    ]),
  },
  {
    id: 'spiral',
    name: 'Spiral',
    width: 9,
    height: 9,
    rows: I([
      '111111111',
      '100000001',
      '101111101',
      '101000101',
      '101010101',
      '101011101',
      '101000001',
      '101111111',
      '100000000',
    ]),
  },
  {
    id: 'wavy-line',
    name: 'Wavy Line',
    width: 17,
    height: 4,
    rows: I([
      '01100000011000000',
      '10010000100100001',
      '00001001000010010',
      '00000110000001100',
    ]),
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    width: 13,
    height: 4,
    rows: I([
      '1000001000001',
      '0100010100010',
      '0010100010100',
      '0001000001000',
    ]),
  },
]

export const ICON_GROUPS = [
  { id: 'shapes', name: 'Shapes' },
  { id: 'botanical', name: 'Botanical' },
  { id: 'celebration', name: 'Celebration' },
  { id: 'hobbies', name: 'Cozy & hobbies' },
  { id: 'fantasy', name: 'Gaming & fantasy' },
  { id: 'spooky', name: 'Spooky & quirky' },
  { id: 'sky', name: 'Sky & weather' },
  { id: 'solidarity', name: 'Solidarity' },
  { id: 'pride', name: 'Pride' },
  { id: 'care', name: 'Care & access' },
  { id: 'greek', name: 'Greek letters' },
  { id: 'more', name: 'More' },
  { id: 'custom', name: 'My icons' },
] as const

const CORE_GROUP: Record<string, string> = {
  heart: 'shapes',
  star: 'shapes',
  diamond: 'shapes',
  circle: 'shapes',
  square: 'shapes',
  triangle: 'shapes',
  'arrow-up': 'shapes',
  spiral: 'shapes',
  'wavy-line': 'shapes',
  zigzag: 'shapes',
  cross: 'shapes',
  lightning: 'shapes',
  moon: 'sky',
  sun: 'sky',
  cloud: 'sky',
  rainbow: 'sky',
  flower: 'botanical',
  rose: 'botanical',
  leaf: 'botanical',
  mushroom: 'botanical',
  strawberry: 'botanical',
  cherries: 'botanical',
  ghost: 'spooky',
}

export const ICON_LIBRARY: IconDef[] = [
  ...CORE_ICONS.map((i) => ({ ...i, group: CORE_GROUP[i.id] ?? 'more' })),
  ...BOTANICAL_ICONS,
  ...CELEBRATION_ICONS,
  ...HOBBIES_ICONS,
  ...FANTASY_ICONS,
  ...SPOOKY_ICONS,
  ...SOLIDARITY_ICONS,
  ...PRIDE_ICONS,
  ...CARE_ICONS,
  ...GREEK_ICONS,
]

// Retired from the picker but still resolvable, so saved projects that used them
// keep rendering the original shape instead of silently falling back to a heart.
const LEGACY_ICONS: IconDef[] = [
  {
    id: 'bee',
    name: 'Bee',
    width: 13,
    height: 8,
    rows: I([
      '0000110011000',
      '0001001100100',
      '0000110011000',
      '0011001100110',
      '0111001100111',
      '1111001100110',
      '0111001100111',
      '0011001100110',
    ]),
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    width: 11,
    height: 10,
    rows: I([
      '00010001000',
      '00001010000',
      '11000100011',
      '11101110111',
      '11110101111',
      '11110101111',
      '01110101110',
      '01110101110',
      '11110101111',
      '01100000110',
    ]),
  },
  {
    id: 'cross',
    name: 'Cross',
    width: 9,
    height: 9,
    rows: I([
      '000111000',
      '000111000',
      '000111000',
      '111111111',
      '111111111',
      '111111111',
      '000111000',
      '000111000',
      '000111000',
    ]),
  },
  {
    id: 'paw',
    name: 'Paw Print',
    width: 9,
    height: 8,
    rows: I([
      '010000010',
      '010000010',
      '000101000',
      '000101000',
      '001111100',
      '011111110',
      '011111110',
      '001111100',
    ]),
  },
  {
    id: 'fist',
    name: 'Raised Fist',
    width: 11,
    height: 13,
    rows: I([
      '00011111000',
      '00111111100',
      '01111111110',
      '01111111110',
      '01111111110',
      '00111111100',
      '00011111000',
      '00011111000',
      '00011111000',
      '00011111000',
      '00011111000',
      '00011111000',
      '00011111000',
    ]),
  },
]

// Tiny (3-5 stitch) decoration icons for Stamp mode — scattering full-size icons
// (7-9 stitches) as accents around a design reads as cluttered, not decorative.
// A different, deliberately simplified bitmap per shape, not the full icon
// shrunk — cross-stitch has no sub-pixel scaling, so "smaller" means redrawing
// the shape at fewer stitches, not scaling an existing bitmap down.
export const MINI_ICON_LIBRARY: IconDef[] = [
  {
    id: 'mini-heart',
    name: 'Tiny Heart',
    width: 5,
    height: 4,
    rows: I(['01010', '11111', '01110', '00100']),
  },
  {
    id: 'mini-star',
    name: 'Tiny Star',
    width: 5,
    height: 5,
    rows: I(['00100', '00100', '11111', '00100', '00100']),
  },
  {
    id: 'mini-dot',
    name: 'Tiny Dot',
    width: 3,
    height: 3,
    rows: I(['010', '111', '010']),
  },
  {
    id: 'mini-diamond',
    name: 'Tiny Diamond',
    width: 5,
    height: 5,
    rows: I(['00100', '01110', '11111', '01110', '00100']),
  },
  {
    id: 'mini-flower',
    name: 'Tiny Flower',
    width: 5,
    height: 5,
    rows: I(['00100', '01010', '10101', '01010', '00100']),
  },
  {
    id: 'mini-leaf',
    name: 'Tiny Leaf',
    width: 5,
    height: 5,
    rows: I(['00011', '00110', '01110', '11100', '10000']),
  },
  {
    id: 'mini-moon',
    name: 'Tiny Moon',
    width: 4,
    height: 5,
    rows: I(['0111', '1100', '1100', '1100', '0111']),
  },
  {
    id: 'mini-dash',
    name: 'Tiny Dash',
    width: 5,
    height: 1,
    rows: I(['11111']),
  },
  {
    id: 'mini-chevron',
    name: 'Tiny Chevron',
    width: 5,
    height: 3,
    rows: I(['10001', '01010', '00100']),
  },
  {
    id: 'mini-flame',
    name: 'Tiny Flame',
    width: 5,
    height: 5,
    rows: I(['00100', '01100', '01110', '11111', '01110']),
  },
  {
    id: 'mini-key',
    name: 'Tiny Key',
    width: 5,
    height: 3,
    rows: I(['11100', '10111', '11101']),
  },
  {
    id: 'mini-infinity',
    name: 'Tiny Infinity',
    width: 5,
    height: 3,
    rows: I(['01010', '10101', '01010']),
  },
]

let customIcons: IconDef[] = []

export function setCustomIcons(icons: IconDef[]): void {
  customIcons = icons
}

export function getIcon(id: string): IconDef {
  return (
    customIcons.find((i) => i.id === id) ??
    ICON_LIBRARY.find((i) => i.id === id) ??
    MINI_ICON_LIBRARY.find((i) => i.id === id) ??
    LEGACY_ICONS.find((i) => i.id === id) ??
    ICON_LIBRARY[0]
  )
}
