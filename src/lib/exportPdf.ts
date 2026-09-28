import { jsPDF } from 'jspdf'
import type { Project } from './types'
import { flattenProject, summarizeColors } from './flattenProject'
import type { FlattenedCell } from './flattenProject'
import { assignSymbols, centerLine, GRID_MAJOR_EVERY, majorLines, planChart, symbolTextIsBlack } from './chartLayout'
import type { ChartTile } from './chartLayout'

const MM_TO_PT = 2.835
const MARGIN = 12
const GUTTER = 6
const HEADER_HEIGHT = 8
const LEGEND_LINE_HEIGHT = 5

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

function drawSymbolCell(doc: jsPDF, hex: string, symbol: string, x: number, y: number, size: number) {
  const [r, g, b] = hexToRgb(hex)
  doc.setFillColor(r, g, b)
  doc.rect(x, y, size, size, 'F')
  doc.setTextColor(symbolTextIsBlack(hex) ? 0 : 255)
  doc.setFontSize(size * MM_TO_PT * (symbol.length > 1 ? 0.45 : 0.65))
  doc.text(symbol, x + size / 2, y + size / 2, { align: 'center', baseline: 'middle' })
  doc.setTextColor(0)
}

export function exportProjectToPdf(project: Project, overrideTitle?: string): void {
  const cells = flattenProject(project)
  const colors = summarizeColors(cells)
  const symbols = assignSymbols(colors)
  const title = overrideTitle || project.name || 'Cross-Stitch Pattern'
  const { widthStitches: width, heightStitches: height } = project

  const orientation = width >= height ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const plan = planChart(width, height, {
    pageWidth,
    pageHeight,
    margin: MARGIN,
    headerHeight: HEADER_HEIGHT,
    gutter: GUTTER,
  })

  const cellAt = new Map<string, FlattenedCell>()
  for (const c of cells) cellAt.set(`${c.x},${c.y}`, c)

  const inchesWidth = (width / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (height / project.fabric.stitchesPerInch).toFixed(1)
  const subtitle = `${width}x${height} stitches - ${inchesWidth}"x${inchesHeight}" at ${project.fabric.stitchesPerInch} stitches/inch`

  function drawHeader(second: string) {
    doc.setFontSize(14)
    doc.text(title, MARGIN, MARGIN)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(second, MARGIN, MARGIN + 5)
    doc.setTextColor(0)
  }

  function drawLegend(startY: number): void {
    let y = startY
    if (y + 12 > pageHeight - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(10)
    doc.text('DMC Colors Used:', MARGIN, y)
    y += 6
    for (const { color, count } of colors) {
      if (y > pageHeight - MARGIN) {
        doc.addPage()
        y = MARGIN
      }
      drawSymbolCell(doc, color.hex, symbols.get(color.dmcCode) ?? '', MARGIN, y - 3.2, 4)
      doc.setDrawColor(0)
      doc.setLineWidth(0.1)
      doc.rect(MARGIN, y - 3.2, 4, 4)
      doc.setFontSize(9)
      doc.text(`DMC ${color.dmcCode} - ${color.name} (${count} stitches)`, MARGIN + 7, y)
      y += LEGEND_LINE_HEIGHT
    }
  }

  function drawTile(tile: ChartTile, gridX: number, gridY: number) {
    const cs = plan.cellSize
    const tileW = (tile.x1 - tile.x0) * cs
    const tileH = (tile.y1 - tile.y0) * cs

    for (let y = tile.y0; y < tile.y1; y++) {
      for (let x = tile.x0; x < tile.x1; x++) {
        const cell = cellAt.get(`${x},${y}`)
        if (!cell) continue
        drawSymbolCell(
          doc,
          cell.color.hex,
          symbols.get(cell.color.dmcCode) ?? '',
          gridX + (x - tile.x0) * cs,
          gridY + (y - tile.y0) * cs,
          cs,
        )
      }
    }

    const isMajor = (i: number) => i % GRID_MAJOR_EVERY === 0
    doc.setDrawColor(200)
    doc.setLineWidth(0.05)
    for (let x = tile.x0; x <= tile.x1; x++) {
      if (isMajor(x)) continue
      const px = gridX + (x - tile.x0) * cs
      doc.line(px, gridY, px, gridY + tileH)
    }
    for (let y = tile.y0; y <= tile.y1; y++) {
      if (isMajor(y)) continue
      const py = gridY + (y - tile.y0) * cs
      doc.line(gridX, py, gridX + tileW, py)
    }
    doc.setDrawColor(60)
    doc.setLineWidth(0.25)
    for (const x of majorLines(tile.x0, tile.x1)) {
      const px = gridX + (x - tile.x0) * cs
      doc.line(px, gridY, px, gridY + tileH)
    }
    for (const y of majorLines(tile.y0, tile.y1)) {
      const py = gridY + (y - tile.y0) * cs
      doc.line(gridX, py, gridX + tileW, py)
    }
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.rect(gridX, gridY, tileW, tileH)

    doc.setFontSize(7)
    doc.setTextColor(90)
    for (const x of majorLines(tile.x0, tile.x1)) {
      if (x === 0) continue
      doc.text(String(x), gridX + (x - tile.x0) * cs, gridY - 3, { align: 'center' })
    }
    for (const y of majorLines(tile.y0, tile.y1)) {
      if (y === 0) continue
      doc.text(String(y), gridX - 1.5, gridY + (y - tile.y0) * cs, { align: 'right', baseline: 'middle' })
    }
    doc.setTextColor(0)

    // Center arrows on every edge the center line reaches, for finding where to start.
    doc.setFillColor(0, 0, 0)
    const cx = centerLine(width)
    if (cx >= tile.x0 && cx <= tile.x1) {
      const px = gridX + (cx - tile.x0) * cs
      doc.triangle(px - 1.2, gridY - 2.4, px + 1.2, gridY - 2.4, px, gridY - 0.4, 'F')
      doc.triangle(px - 1.2, gridY + tileH + 2.4, px + 1.2, gridY + tileH + 2.4, px, gridY + tileH + 0.4, 'F')
    }
    const cy = centerLine(height)
    if (cy >= tile.y0 && cy <= tile.y1) {
      const py = gridY + (cy - tile.y0) * cs
      doc.triangle(gridX - 2.4, py - 1.2, gridX - 2.4, py + 1.2, gridX - 0.4, py, 'F')
      doc.triangle(gridX + tileW + 2.4, py - 1.2, gridX + tileW + 2.4, py + 1.2, gridX + tileW + 0.4, py, 'F')
    }
  }

  const gridTop = MARGIN + HEADER_HEIGHT + GUTTER
  const gridLeft = MARGIN + GUTTER

  // Pages with no stitches on them aren't printed (their outlines are left off the overview too).
  const nonEmpty = plan.tiles.filter((t) => cells.some((c) => c.x >= t.x0 && c.x < t.x1 && c.y >= t.y0 && c.y < t.y1))
  const printTiles = nonEmpty.length > 0 ? nonEmpty : plan.tiles.slice(0, 1)

  if (printTiles.length === 1) {
    drawHeader(subtitle)
    const tile = printTiles[0]
    drawTile(tile, gridLeft, gridTop)
    drawLegend(gridTop + (tile.y1 - tile.y0) * plan.cellSize + 10)
  } else {
    drawOverview()
    printTiles.forEach((tile, i) => {
      doc.addPage()
      drawHeader(`Page ${i + 1} of ${printTiles.length} - columns ${tile.x0 + 1}-${tile.x1}, rows ${tile.y0 + 1}-${tile.y1}`)
      drawTile(tile, gridLeft, gridTop)
    })
  }

  function drawOverview() {
    drawHeader(subtitle)
    const mapTop = MARGIN + HEADER_HEIGHT + 2
    const mapCell = Math.min((pageWidth - MARGIN * 2) / width, (pageHeight * 0.45) / height, 2)
    for (const c of cells) {
      const [r, g, b] = hexToRgb(c.color.hex)
      doc.setFillColor(r, g, b)
      doc.rect(MARGIN + c.x * mapCell, mapTop + c.y * mapCell, mapCell, mapCell, 'F')
    }
    doc.setDrawColor(0)
    doc.setLineWidth(0.2)
    doc.rect(MARGIN, mapTop, width * mapCell, height * mapCell)
    doc.setDrawColor(150)
    doc.setLineWidth(0.15)
    doc.setFontSize(8)
    doc.setTextColor(120)
    printTiles.forEach((t, i) => {
      const x = MARGIN + t.x0 * mapCell
      const y = mapTop + t.y0 * mapCell
      const w = (t.x1 - t.x0) * mapCell
      const h = (t.y1 - t.y0) * mapCell
      doc.rect(x, y, w, h)
      doc.text(String(i + 1), x + w - 1, y + h - 1, { align: 'right' })
    })
    doc.setTextColor(0)
    drawLegend(mapTop + height * mapCell + 10)
  }

  const filename = `${title.trim().replace(/\s+/g, '-').toLowerCase()}.pdf`
  doc.save(filename)
}
