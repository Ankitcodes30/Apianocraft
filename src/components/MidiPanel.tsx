import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { MidiManager, MidiStats, MidiSupport } from '../midi/MidiManager'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Badge } from './ui/badge'

interface PanelState {
  support: MidiSupport
  error?: string
  devices: { id: string; name: string; manufacturer: string; connected: boolean }[]
  selected: string | null
}

interface ActivityView {
  name: string
  at: number
  note?: number
  value?: number
}

interface PerfView {
  bend: number
  bendCents: number
  range: number
  modulation: number
  sustain: boolean
}

/**
 * MIDI panel. Subscribes only to low-frequency MidiManager events:
 * support/device changes and throttled activity. Note events never touch React.
 */
export function MidiPanel({ midi, engine }: { midi: MidiManager; engine: AudioEngine }) {
  const [panel, setPanel] = useState<PanelState>(() => midi.getState())
  const [activity, setActivity] = useState<ActivityView | null>(null)
  const [perf, setPerf] = useState<PerfView>(() => ({
    bend: engine.pitchBendValue,
    bendCents: engine.pitchBendCentsValue,
    range: engine.pitchBendRangeSemitones,
    modulation: engine.modulationValue,
    sustain: engine.sustainEnabled,
  }))
  const [stats, setStats] = useState<MidiStats>(() => midi.getStats())

  useEffect(() => {
    const refresh = () => {
      setStats(midi.getStats())
      setPerf({
        bend: engine.pitchBendValue,
        bendCents: engine.pitchBendCentsValue,
        range: engine.pitchBendRangeSemitones,
        modulation: engine.modulationValue,
        sustain: engine.sustainEnabled,
      })
    }
    const unsub = midi.subscribe((e) => {
      if (e.type === 'state' || e.type === 'devices') setPanel(midi.getState())
      else if (e.type === 'activity') {
        setActivity({ name: e.lastEvent, at: e.at, note: e.note, value: e.value })
        refresh()
      }
    })
    const id = window.setInterval(refresh, 500)
    return () => {
      unsub()
      window.clearInterval(id)
    }
  }, [midi, engine])

  const available = panel.support === 'available'
  const connected = panel.devices.filter((d) => d.connected)
  const selected = panel.devices.find((d) => d.id === panel.selected)
  const ageMs = activity ? Math.round(performance.now() - activity.at) : -1

  return (
    <Card className="midi-panel border-border" aria-label="MIDI panel">
      <CardHeader className="p-2.5 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">MIDI INPUT & HARDWARE</span>
          <Badge variant="accent" className="chip chip--accent font-bold">MIDI</Badge>
          <Badge
            variant={available ? 'ok' : panel.support === 'unavailable' ? 'bad' : 'warn'}
            className={`chip chip--${available ? 'ok' : panel.support === 'unavailable' ? 'bad' : 'warn'}`}
          >
            {available ? 'AVAILABLE' : panel.support === 'unavailable' ? 'UNAVAILABLE' : '…'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        {available && (
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              className="select w-44 text-xs font-semibold"
              aria-label="MIDI input device"
              value={panel.selected ?? ''}
              disabled={connected.length === 0}
              onChange={(e) => midi.selectInput(e.target.value || null)}
            >
              {connected.length === 0 && <option value="">no devices</option>}
              {connected.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || 'Unnamed input'}
                </option>
              ))}
            </Select>
            <span className="chip text-xs" data-midi-connection>
              {selected ? `connected: ${selected.name}` : 'no device selected'}
            </span>
            <span className={`w-2 h-2 rounded-full transition-colors ${activity && ageMs < 1500 ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/30'}`} aria-label="MIDI activity" />
            <span className="chip midi-activity text-xs font-mono" data-midi-activity>
              {activity ? `${activity.name}${activity.note !== undefined ? ` ${activity.note}` : ''}` : 'idle'}
              <span className="midi-activity__msg opacity-60 ml-1">({stats.messages} msgs)</span>
            </span>
            <span className="chip text-xs font-mono" data-midi-sustain>
              sustain {perf.sustain ? 'ON' : 'off'}
            </span>
            <span className="chip text-xs font-mono" data-midi-bend>
              bend {perf.bendCents > 0 ? '+' : ''}
              {perf.bendCents.toFixed(0)}c
              <span className="midi-meter inline-block w-8 h-1 bg-secondary rounded overflow-hidden align-middle ml-1">
                <span className="midi-meter__fill block h-full bg-indigo-500" style={{ left: `${((perf.bend + 1) / 2) * 100}%` }} />
              </span>
            </span>
            <span className="chip text-xs font-mono" data-midi-mod>
              mod {(perf.modulation * 100).toFixed(0)}%
            </span>
            <Select
              className="select w-28 text-xs font-semibold"
              aria-label="Pitch bend range"
              value={String(perf.range)}
              onChange={(e) => engine.setPitchBendRange(Number(e.target.value))}
            >
              <option value="2">bend ±2 st</option>
              <option value="12">bend ±12 st</option>
            </Select>
          </div>
        )}
        {panel.support === 'unavailable' && (
          <span className="chip chip--warn text-xs font-semibold">MIDI not supported — QWERTY/mouse still work</span>
        )}
      </CardContent>
    </Card>
  )
}
