import { getFont } from './fonts'
import { createId } from './id'
import { measureText } from './textRender'
import type { TextObject } from './types'

const LETTER_SPACING = 1

// One text object per non-space character, each at exactly the stitches it occupied
// in the whole string (rotation included), so splitting never changes the pattern.
// Letters keep the source's groupId so a grouped string stays in its group.
export function splitTextObject(obj: TextObject): TextObject[] {
  const font = getFont(obj.font)
  const chars = [...obj.content.normalize('NFC')]
  const whole = measureText(obj.content, font, obj.direction, obj.scale)
  const rotation = ((obj.rotation % 360) + 360) % 360
  const gap = LETTER_SPACING * obj.scale
  const letters: TextObject[] = []

  chars.forEach((char, i) => {
    if (char.trim() === '') return
    const before = i === 0 ? null : measureText(chars.slice(0, i).join(''), font, obj.direction, obj.scale)
    const size = measureText(char, font, obj.direction, obj.scale)
    const ox = obj.direction === 'horizontal' && before ? before.width + gap : 0
    const oy = obj.direction === 'vertical' && before ? before.height + gap : 0

    let dx = ox
    let dy = oy
    if (rotation === 90) {
      dx = whole.height - oy - size.height
      dy = ox
    } else if (rotation === 180) {
      dx = whole.width - ox - size.width
      dy = whole.height - oy - size.height
    } else if (rotation === 270) {
      dx = oy
      dy = whole.width - ox - size.width
    }

    letters.push({ ...obj, id: createId(), content: char, x: obj.x + dx, y: obj.y + dy })
  })

  return letters
}
