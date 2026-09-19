import { jsPDF } from 'jspdf'
import type { Project } from './types'
import { flattenProject, summarizeColors } from './flattenProject'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

export function exportProjectToPdf(project: Project): void {
  const cells = flattenProject(project)
  const colors = summarizeColors(cells)

  const orientation = project.widthStitches >= project.heightStitches ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const legendLineHeight = 5
  const legendHeight = 8 + colors.length * legendLineHeight
  const gridY = margin + 8
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - gridY - margin - legendHeight

  // Fits the whole grid on one page rather than paginating — a design's own
  // physical fabric size (shown right next to it) is what matters for actually
  // stitching it; the printed PDF is a reference chart, not 1:1 scale.
  const cellSize = Math.max(
    0.5,
    Math.min(availableWidth / project.widthStitches, availableHeight / project.heightStitches),
  )
  const gridWidthMm = cellSize * project.widthStitches
  const gridHeightMm = cellSize * project.heightStitches
  const gridX = margin

  doc.setFontSize(14)
  doc.text(project.name || 'Cross-Stitch Pattern', margin, margin)
  doc.setFontSize(9)
  doc.setTextColor(120)
  const inchesWidth = (project.widthStitches / project.fabric.stitchesPerInch).toFixed(1)
  const inchesHeight = (project.heightStitches / project.fabric.stitchesPerInch).toFixed(1)
  doc.text(
    `${project.widthStitches}x${project.heightStitches} stitches - ${inchesWidth}"x${inchesHeight}" at ${project.fabric.stitchesPerInch} stitches/inch`,
    margin,
    margin + 5,
  )
  doc.setTextColor(0)

  for (const cell of cells) {
    const [r, g, b] = hexToRgb(cell.color.hex)
    doc.setFillColor(r, g, b)
    doc.rect(gridX + cell.x * cellSize, gridY + cell.y * cellSize, cellSize, cellSize, 'F')
  }

  doc.setDrawColor(210)
  doc.setLineWidth(0.05)
  for (let x = 0; x <= project.widthStitches; x++) {
    doc.line(gridX + x * cellSize, gridY, gridX + x * cellSize, gridY + gridHeightMm)
  }
  for (let y = 0; y <= project.heightStitches; y++) {
    doc.line(gridX, gridY + y * cellSize, gridX + gridWidthMm, gridY + y * cellSize)
  }
  doc.setDrawColor(0)
  doc.rect(gridX, gridY, gridWidthMm, gridHeightMm)

  let legendY = gridY + gridHeightMm + 8
  doc.setFontSize(10)
  doc.text('DMC Colors Used:', margin, legendY)
  legendY += 6
  doc.setFontSize(9)
  for (const { color, count } of colors) {
    const [r, g, b] = hexToRgb(color.hex)
    doc.setFillColor(r, g, b)
    doc.rect(margin, legendY - 3.2, 4, 4, 'F')
    doc.setDrawColor(0)
    doc.rect(margin, legendY - 3.2, 4, 4)
    doc.text(`DMC ${color.dmcCode} - ${color.name} (${count} stitches)`, margin + 7, legendY)
    legendY += legendLineHeight
  }

  const filename = `${(project.name || 'cross-stitch-pattern').trim().replace(/\s+/g, '-').toLowerCase()}.pdf`
  doc.save(filename)
}
