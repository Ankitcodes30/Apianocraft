import { useEffect, useState } from 'react'
import { getEngine } from './audio/AudioEngine'
import { PianoKeyboard } from './components/PianoKeyboard'
import { EngineStatus } from './components/EngineStatus'
import { SampleStatus } from './components/SampleStatus'
import { ErrorBanner } from './components/ErrorBanner'
import { WorkstationInspector } from './components/WorkstationInspector'
import { getMidiManager } from './midi/MidiManager'
import { getNoteEventBus } from './midi/NoteEventBus'
import { getQwertyManager } from './keyboard/QwertyManager'
import { pushError } from './utils/ErrorBus'
import { installTestHarness } from './testHarness'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'
import { ThemeSelector } from './components/ThemeSelector'
import { MousePerformanceToggle } from './components/MousePerformanceToggle'
import { BrandLogo } from './components/BrandLogo'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'

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
    <div className="app font-sans bg-[#181818] text-[#F2F2F2] antialiased">
      <OfflineBanner />

      {/* ── Neutral Professional Header ── */}
      <header className="app__bar flex items-center justify-between gap-3 px-3 py-1 bg-[#202020] border border-[#3A3A3A] rounded-[4px]">
        {/* LEFT: Brand Lockup */}
        <BrandLogo />

        {/* CENTER: Active Instrument Tone Display */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 bg-[#292929] rounded-[4px] border border-[#3A3A3A]">
          <span className="text-[9px] text-[#808080] font-bold uppercase tracking-wider font-mono">
            ACTIVE TONE
          </span>
          <Select
            className="chip select text-xs font-semibold w-40 h-6 border-0 bg-transparent py-0 px-1 text-[#F2F2F2]"
            aria-label="Active Instrument Tone"
            data-instrument-select
            value={instrumentId}
            onChange={(e) => void engine.setInstrument(e.target.value)}
          >
            {engine.getInstruments().map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>

        {/* RIGHT: Quick Telemetry & Status */}
        <div className="flex items-center gap-2">
          <SampleStatus engine={engine} instrumentId={instrumentId} />
          <EngineStatus engine={engine} />
        </div>
      </header>

      {/* ── Professional Workstation Toolbar ── */}
      <nav className="flex items-center justify-between gap-2 px-3 py-1 bg-[#202020] border border-[#3A3A3A] rounded-[4px] shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={tuning.sustain ? 'on' : 'outline'}
            size="sm"
            onClick={() => engine.toggleSustain()}
            disabled={!ready}
            title="Toggle Sustain Pedal (Spacebar)"
            className={tuning.sustain ? 'bg-[#5B7FA3] border-[#5B7FA3] text-white font-semibold' : 'bg-[#292929] border-[#3A3A3A] text-[#D5D5D5] font-medium'}
          >
            Sustain {tuning.sustain ? 'ON' : 'OFF'}
          </Button>

          <Button
            type="button"
            variant="panic"
            size="sm"
            onClick={() => engine.releaseAll()}
            disabled={!ready}
            title="Panic / All Notes Off (Escape)"
            className="btn--panic text-xs font-semibold"
          >
            Panic
          </Button>

          <MousePerformanceToggle />
        </div>

        <div className="flex items-center gap-2">
          <ThemeSelector />
        </div>
      </nav>

      {tuning.state === 'suspended' && (
        <div className="warn flex items-center gap-2 text-xs py-1.5 px-3 bg-[#2A241F] border border-[#C89040]/60 text-[#F2F2F2] rounded-[4px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C89040]" />
          <span>Audio engine is paused — click anywhere to initialize Web Audio context.</span>
        </div>
      )}
      {bootError && <div className="warn py-1.5 px-3 text-xs bg-[#2A1F1F] border border-[#A84A4A]/60 text-[#F2F2F2] rounded-[4px]">Startup problem: {bootError}</div>}

      {/* ── Workstation Tabbed Inspector ── */}
      <ErrorBoundary name="Workstation Inspector">
        <WorkstationInspector engine={engine} />
      </ErrorBoundary>

      {/* ── Piano Keyboard Centerpiece Viewport ── */}
      <main className="app-piano-container flex-1 flex flex-col min-h-[180px]" aria-label="Piano keyboard surface">
        <ErrorBoundary name="Piano Keyboard">
          <PianoKeyboard engine={engine} />
        </ErrorBoundary>
      </main>

      <ErrorBanner />
    </div>
  )
}
