import { useEffect, useState } from 'react'
import { getEngine } from './audio/AudioEngine'
import { PianoKeyboard } from './components/PianoKeyboard'
import { EngineStatus } from './components/EngineStatus'
import { SampleStatus } from './components/SampleStatus'
import { ErrorBanner } from './components/ErrorBanner'
import { MidiPanel } from './components/MidiPanel'
import { PerformancePad } from './components/PerformancePad'
import { MainTonePanel } from './components/MainTonePanel'
import { DualTonePanel } from './components/DualTonePanel'
import { MasterPanel } from './components/MasterPanel'
import { SplitPanel } from './components/SplitPanel'
import { PresetPanel } from './components/PresetPanel'
import { RecorderPanel } from './components/RecorderPanel'
import { WorkstationToolsPanel } from './components/WorkstationToolsPanel'
import { KeyboardPanel } from './components/KeyboardPanel'
import { getMidiManager } from './midi/MidiManager'
import { getNoteEventBus } from './midi/NoteEventBus'
import { getQwertyManager } from './keyboard/QwertyManager'
import { pushError } from './utils/ErrorBus'
import { installTestHarness } from './testHarness'

interface TuningUiState {
  state: AudioContextState | 'closed'
  sustain: boolean
}

export default function App() {
  const [engine] = useState(getEngine)
  const [instrumentId, setInstrumentId] = useState(engine.instrumentId)
  const [tuning, setTuning] = useState<TuningUiState>(() => ({
    state: engine.state,
    sustain: engine.sustainEnabled,
  }))
  const [bootError, setBootError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const unsub = engine.subscribe((e) => {
      if (!alive) return
      if (e.type === 'state') setTuning((t) => ({ ...t, state: e.state }))
      else if (e.type === 'tuning') setTuning((t) => ({ ...t, sustain: engine.sustainEnabled }))
      else if (e.type === 'load') setInstrumentId(e.instrumentId)
      else if (e.type === 'error') pushError('error', e.error.message)
    })
    engine
      .create()
      .then(() => {
        if (alive) setReady(true)
      })
      .catch((err: unknown) => {
        if (alive) setBootError(err instanceof Error ? err.message : String(err))
      })
    const unlockOnGesture = () => void engine.unlock()
    window.addEventListener('pointerdown', unlockOnGesture)
    installTestHarness(engine)

    // Phase 5: normalized event bus -> engine. MIDI never touches the engine
    // directly; it emits bus events and this adapter forwards them.
    const bus = getNoteEventBus()
    const unsubBus = bus.subscribe((e) => {
      switch (e.kind) {
        case 'note-on':
          engine.noteOn({ note: e.note, velocity: e.velocity, source: e.source })
          break
        case 'note-off':
          engine.noteOff({ note: e.note })
          break
        case 'sustain':
          if (e.on) engine.sustainOn()
          else engine.sustainOff()
          break
        case 'pitch-bend':
          engine.setPitchBend(e.value)
          break
        case 'modulation':
          engine.setModulation(e.value)
          break
        case 'panic':
          engine.releaseAll()
          break
      }
    })
    const midi = getMidiManager(bus)
    void midi.start()
    // Phase 7.5: QWERTY computer keyboard — same bus, source 'keyboard'.
    const qwerty = getQwertyManager(bus)
    qwerty.start()

    return () => {
      alive = false
      unsub()
      unsubBus()
      qwerty.stop()
      window.removeEventListener('pointerdown', unlockOnGesture)
    }
  }, [engine])

  return (
    <div className="app">
      <header className="app__bar">
        <span className="brand">Apianocraft</span>
        <select
          className="chip select"
          aria-label="Instrument"
          value={instrumentId}
          disabled={!ready}
          onChange={(e) => void engine.setInstrument(e.target.value)}
        >
          {engine.getInstruments().map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <SampleStatus engine={engine} instrumentId={instrumentId} />
        <EngineStatus engine={engine} />
      </header>

      {tuning.state === 'suspended' && (
        <div className="warn">Audio is paused — click anywhere to enable sound.</div>
      )}
      {bootError && <div className="warn">Startup problem: {bootError}</div>}

      <section className="ctl" aria-label="Performance controls">
        <PerformancePad engine={engine} />
        <MidiPanel midi={getMidiManager(getNoteEventBus())} engine={engine} />
        <KeyboardPanel qwerty={getQwertyManager(getNoteEventBus())} />
        <button
          type="button"
          className={`btn${tuning.sustain ? ' btn--on' : ''}`}
          onClick={() => engine.toggleSustain()}
          disabled={!ready}
        >
          Sustain {tuning.sustain ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="btn" onClick={() => engine.releaseAll()} disabled={!ready}>
          Panic
        </button>
      </section>

      <WorkstationToolsPanel />
      <RecorderPanel />
      <PresetPanel />
      <MainTonePanel engine={engine} />
      <DualTonePanel engine={engine} />
      <SplitPanel />
      <MasterPanel />

      <PianoKeyboard engine={engine} />
      <ErrorBanner />
    </div>
  )
}
