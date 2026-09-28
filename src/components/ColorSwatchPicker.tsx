import { useState } from 'react'
import type { StitchColor } from '../lib/types'
import { DMC_STARTER_COLORS, searchDmcColors } from '../lib/dmcColors'

type ColorSwatchPickerProps = {
  selected: StitchColor
  onSelect: (color: StitchColor) => void
  startExpanded?: boolean
}

export function ColorSwatchPicker({ selected, onSelect, startExpanded = false }: ColorSwatchPickerProps) {
  const [expanded, setExpanded] = useState(startExpanded)
  const [query, setQuery] = useState('')
  const selectedIsStarter = DMC_STARTER_COLORS.some((c) => c.dmcCode === selected.dmcCode)
  const swatches = selectedIsStarter ? DMC_STARTER_COLORS : [...DMC_STARTER_COLORS, selected]
  const matches = expanded ? searchDmcColors(query) : []

  function swatch(c: StitchColor) {
    return (
      <button
        key={c.dmcCode}
        type="button"
        className={`swatch${selected.dmcCode === c.dmcCode ? ' swatch--selected' : ''}`}
        style={{ backgroundColor: c.hex }}
        title={`DMC ${c.dmcCode} · ${c.name}`}
        aria-label={`DMC ${c.dmcCode} ${c.name}`}
        onClick={() => onSelect(c)}
      />
    )
  }

  return (
    <div className="color-picker">
      <div className="swatch-row">
        {swatches.map(swatch)}
        <button type="button" className="color-picker__more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Fewer' : 'More colors'}
        </button>
      </div>
      <p className="color-picker__selected">
        DMC {selected.dmcCode} · {selected.name}
      </p>
      {expanded && (
        <div className="color-picker__browser">
          <input
            type="search"
            placeholder="Search DMC number or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length === 0 ? (
            <p className="tool-placeholder">No DMC colors match “{query}”.</p>
          ) : (
            <div className="swatch-row color-picker__grid">{matches.map(swatch)}</div>
          )}
        </div>
      )}
    </div>
  )
}
