export type CornerHandle = 'nw' | 'ne' | 'sw' | 'se'

export type ResizeParams = {
  handle: CornerHandle
  anchorXStitch: number
  anchorYStitch: number
  pointerXStitch: number
  baseWidth: number
  baseHeight: number
  maxScale: number
  minScale?: number
}

export type ResizeResult = { scale: number; x: number; y: number }

// Uniform pixel-art scaling only — no independent width/height stretch, since a
// fractional or non-uniform scale would put half-stitches on the grid (out of
// scope per the project's own rules). Horizontal pointer distance from the fixed
// (anchor) corner drives the scale; the aspect ratio is always preserved.
export function computeResizeFromHandle({
  handle,
  anchorXStitch,
  anchorYStitch,
  pointerXStitch,
  baseWidth,
  baseHeight,
  maxScale,
  minScale = 1,
}: ResizeParams): ResizeResult {
  const rawScale = Math.round(Math.abs(pointerXStitch - anchorXStitch) / baseWidth)
  const scale = Math.min(maxScale, Math.max(minScale, rawScale || minScale))
  const width = baseWidth * scale
  const height = baseHeight * scale

  const isWestAnchor = handle === 'ne' || handle === 'se' // anchor is on the west (left) side
  const isNorthAnchor = handle === 'sw' || handle === 'se' // anchor is on the north (top) side

  const x = isWestAnchor ? anchorXStitch : anchorXStitch - width
  const y = isNorthAnchor ? anchorYStitch : anchorYStitch - height

  return { scale, x, y }
}
