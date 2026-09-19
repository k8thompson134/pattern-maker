import type { StitchColor } from '../lib/types'
import { DMC_STARTER_COLORS } from '../lib/dmcColors'

type ColorSwatchPickerProps = {
  selected: StitchColor
  onSelect: (color: StitchColor) => void
}

export function ColorSwatchPicker({ selected, onSelect }: ColorSwatchPickerProps) {
  return (
    <div className="swatch-row">
      {DMC_STARTER_COLORS.map((c) => (
        <button
          key={c.dmcCode}
          type="button"
          className={`swatch${selected.dmcCode === c.dmcCode ? ' swatch--selected' : ''}`}
          style={{ backgroundColor: c.hex }}
          title={`DMC ${c.dmcCode} · ${c.name}`}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  )
}
