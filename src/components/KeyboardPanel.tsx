import { useEffect, useRef, useState } from 'react'
import type { QwertyManager, QwertyKeyMapping } from '../keyboard/QwertyManager'
import { PRIMARY_38_KEYMAP } from '../keyboard/QwertyManager'
import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'

/**
 * Computer-keyboard workstation panel (Phase 14 38-Key Redesign).
 * Displays the 38-key continuous chromatic layout with Sargam annotations (C# = Sa),
 * 3-octave range sections (-1 / 0 / +1), and live held-key visual feedback.
 */
export function KeyboardPanel({ qwerty }: { qwerty: QwertyManager }) {
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1
  const [octave, setOctave] = useState(() => qwerty.getState().octave)
  const [heldKeys, setHeldKeys] = useState<string[]>(() => qwerty.getState().heldKeys)

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.qwertyRenders = renderBox.current
    return qwerty.subscribe((e) => {
      if (e.type === 'octave') setOctave(e.octave)
      if (e.type === 'held-keys') setHeldKeys(e.keys)
    })
  }, [qwerty])

  const lowerRange = PRIMARY_38_KEYMAP.filter((m) => m.rangeLabel === 'Lower (-1)')
  const middleRange = PRIMARY_38_KEYMAP.filter((m) => m.rangeLabel === 'Middle (0)')
  const upperRange = PRIMARY_38_KEYMAP.filter((m) => m.rangeLabel === 'Upper (+1)')

  const renderKeyGroup = (label: string, mappings: QwertyKeyMapping[]) => (
    <div className="kbd-range-group inline-flex flex-col gap-1 my-1 mx-2">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex gap-0.5 flex-nowrap">
        {mappings.map((m) => {
          const isHeld = heldKeys.includes(m.key)
          return (
            <div
              key={m.key}
              title={`${m.displayLabel} → ${m.noteName}${m.octave} (${m.sargam}) [MIDI ${m.midiNote}]`}
              className={`flex flex-col items-center justify-center p-1 rounded min-w-[28px] text-[10px] font-mono border transition-all ${
                isHeld
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30 scale-105'
                  : m.isBlackKey
                  ? 'bg-slate-900 text-slate-100 border-slate-700'
                  : 'bg-slate-800 text-slate-200 border-slate-600'
              }`}
            >
              <strong className={`text-xs ${m.isBlackKey ? 'text-sky-400' : 'text-white'}`}>
                {m.displayLabel}
              </strong>
              <span className="text-[9px] opacity-90">{m.noteName}{m.octave}</span>
              <span className={`text-[9px] ${m.sargam === 'Sa' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                {m.sargam}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <Card className="kbd-panel border-border" aria-label="Computer keyboard input">
      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-xs tracking-wider text-foreground">QWERTY 38-KEY LAYOUT</span>
          <Badge variant="accent" className="chip chip--accent font-semibold">QWERTY 38-Key</Badge>
          <Badge variant="ok" className="chip chip--ok">C# = Sa (Sargam)</Badge>
          <Badge variant="secondary" className="chip" data-qwerty-octave>
            Octave {octave > 0 ? '+' : ''}{octave}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="flex flex-wrap gap-2 items-start">
          {renderKeyGroup('Lower Range (-1)', lowerRange)}
          {renderKeyGroup('Middle Range (0)', middleRange)}
          {renderKeyGroup('Upper Range (+1)', upperRange)}
        </div>
      </CardContent>
    </Card>
  )
}
