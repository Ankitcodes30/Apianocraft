import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { MidiManager, MidiStats, MidiSupport } from '../midi/MidiManager'

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
 * Minimal MIDI panel (Phase 5, not the final UI). Subscribes only to
 * low-frequency MidiManager events: support/device changes and throttled
 * activity (~10/s). Note events never touch React — they flow bus -> engine.
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
    <section className="midi-panel" aria-label="MIDI panel">
      <span className="chip chip--accent">MIDI</span>
      <span className={`chip chip--${available ? 'ok' : panel.support === 'unavailable' ? 'bad' : 'warn'}`}>
        {available ? 'available' : panel.support === 'unavailable' ? 'unavailable' : '…'}
      </span>

      {available && (
        <>
          <select
            className="select"
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
          </select>
          <span className="chip" data-midi-connection>
            {selected ? `connected: ${selected.name}` : 'no device selected'}
          </span>
          <span className={`midi-led${activity && ageMs < 1500 ? ' midi-led--on' : ''}`} aria-label="MIDI activity" />
          <span className="chip midi-activity" data-midi-activity>
            {activity ? `${activity.name}${activity.note !== undefined ? ` ${activity.note}` : ''}` : 'idle'}
            <span className="midi-activity__msg">{stats.messages} msgs</span>
          </span>
          <span className="chip" data-midi-sustain>
            sustain {perf.sustain ? 'ON' : 'off'}
          </span>
          <span className="chip" data-midi-bend>
            bend {perf.bendCents > 0 ? '+' : ''}
            {perf.bendCents.toFixed(0)}c
            <span className="midi-meter">
              <span className="midi-meter__fill" style={{ left: `${((perf.bend + 1) / 2) * 100}%` }} />
            </span>
          </span>
          <span className="chip" data-midi-mod>
            mod {(perf.modulation * 100).toFixed(0)}%
          </span>
          <select
            className="select"
            aria-label="Pitch bend range"
            value={String(perf.range)}
            onChange={(e) => engine.setPitchBendRange(Number(e.target.value))}
          >
            <option value="2">bend ±2 st</option>
            <option value="12">bend ±12 st</option>
          </select>
        </>
      )}
      {panel.support === 'unavailable' && <span className="chip chip--warn">MIDI not supported — QWERTY/mouse still work</span>}
    </section>
  )
}
