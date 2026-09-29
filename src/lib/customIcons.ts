import { renderIconToCells } from './iconRender'
import type { IconDef } from './icons'
import { createId } from './id'
import type { PixelObject, StitchColor } from './types'

export const CUSTOM_GROUP = 'custom'
const STORAGE_KEY = 'cross-stitch-tool:custom-icons'

type IconStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadCustomIcons(storage: IconStorage = localStorage): IconDef[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomIcons(icons: IconDef[], storage: IconStorage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(icons))
}

export function customIconId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${CUSTOM_GROUP}-${slug || 'icon'}`
}

// Turns an icon into an editable drawing, centered on the canvas, colored with the given main/accent colors.
export function iconToPixelObject(
  icon: IconDef,
  main: StitchColor,
  accent: StitchColor,
  canvasWidth: number,
  canvasHeight: number,
): PixelObject {
  const x = Math.max(0, Math.floor((canvasWidth - icon.width) / 2))
  const y = Math.max(0, Math.floor((canvasHeight - icon.height) / 2))
  return {
    id: createId(),
    kind: 'pixels',
    x,
    y,
    cells: renderIconToCells(icon).map((c) => ({ dx: c.dx, dy: c.dy, color: c.accent ? accent : main })),
  }
}

export type IconFromDrawing = { ok: true; icon: IconDef } | { ok: false; error: string }

// The most-used color becomes the main stitch ('1'), a second color becomes the accent ('2'); a third is refused.
export function pixelObjectToIcon(obj: PixelObject, name: string): IconFromDrawing {
  if (obj.cells.length === 0) return { ok: false, error: 'The drawing is empty.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Give the icon a name.' }

  const counts = new Map<string, { color: StitchColor; count: number }>()
  for (const c of obj.cells) {
    const entry = counts.get(c.color.dmcCode)
    if (entry) entry.count++
    else counts.set(c.color.dmcCode, { color: c.color, count: 1 })
  }
  if (counts.size > 2) {
    return { ok: false, error: `Icons hold at most two colors; this drawing uses ${counts.size}.` }
  }
  const [mainEntry, accentEntry] = [...counts.values()].sort((a, b) => b.count - a.count)

  const width = Math.max(...obj.cells.map((c) => c.dx)) + 1
  const height = Math.max(...obj.cells.map((c) => c.dy)) + 1
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('0'))
  for (const c of obj.cells) {
    grid[c.dy][c.dx] = c.color.dmcCode === mainEntry.color.dmcCode ? '1' : '2'
  }

  return {
    ok: true,
    icon: {
      id: customIconId(trimmed),
      name: trimmed,
      group: CUSTOM_GROUP,
      width,
      height,
      main: mainEntry.color.dmcCode,
      ...(accentEntry ? { accent: accentEntry.color.dmcCode } : {}),
      rows: grid.map((r) => r.join('')),
    },
  }
}

// A source-code entry in the same shape as the built-in icon files, for pasting into one.
export function iconToSource(icon: IconDef, group: string): string {
  const id = icon.id.startsWith(`${CUSTOM_GROUP}-`) ? icon.id.slice(CUSTOM_GROUP.length + 1) : icon.id
  const lines = [
    '  {',
    `    id: '${id}',`,
    `    name: '${icon.name.replace(/'/g, "\\'")}',`,
    `    group: '${group}',`,
    `    width: ${icon.width},`,
    `    height: ${icon.height},`,
    ...(icon.main ? [`    main: '${icon.main}',`] : []),
    ...(icon.accent ? [`    accent: '${icon.accent}',`] : []),
    '    rows: [',
    ...icon.rows.map((r) => `      '${r}',`),
    '    ],',
    '  },',
  ]
  return lines.join('\n')
}
