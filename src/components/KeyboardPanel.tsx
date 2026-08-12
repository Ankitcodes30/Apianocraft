import { useEffect, useRef, useState } from 'react'
import type { QwertyManager } from '../keyboard/QwertyManager'

/**
 * Computer-keyboard indicator (Phase 7.5). Deliberately tiny: one row of
 * chips showing the current QWERTY octave and the key mapping. Re-renders
 * only when the octave changes (rare) — note events never touch React.
 */
export function KeyboardPanel({ qwerty }: { qwerty: QwertyManager }) {
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1
  const [octave, setOctave] = useState(() => qwerty.getState().octave)

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.qwertyRenders = renderBox.current
    return qwerty.subscribe((e) => {
      if (e.type === 'octave') setOctave(e.octave)
    })
  }, [qwerty])

  return (
    <section className="kbd-panel" aria-label="Computer keyboard input">
      <span className="chip chip--accent">QWERTY</span>
      <span className="chip" data-qwerty-octave>
        oct {octave > 0 ? '+' : ''}
        {octave}
      </span>
      <span className="chip kbd-panel__map" title="Computer keyboard piano layout">
        A W S E D F T G Y H U J · Z/X octave
      </span>
    </section>
  )
}
