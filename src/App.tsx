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
import { SettingsModal } from './components/SettingsModal'
import { BrandLogo } from './components/BrandLogo'
import { Button } from './components/ui/button'

interface TuningUiState {
  state: AudioContextState | 'closed'
  sustain: boolean
}

export default function App() {
  const [engine] = useState(getEngine)
  const [instrumentId, setInstrumentId] = useState(engine.instrumentId)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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

    // Central UI Mouse Focus Architecture:
    // Releasing mouse pointer interaction from non-text controls (buttons, range sliders, selects, reset icons, steppers)
    // prevents stale focus highlights from persisting during QWERTY piano play, while preserving keyboard Tab navigation.
    const handleGlobalPointerUp = () => {
      const activeEl = document.activeElement
      if (!activeEl || !(activeEl instanceof HTMLElement)) return

      const tag = activeEl.tagName.toLowerCase()
      if (tag === 'textarea' || tag === 'select' || activeEl.isContentEditable) return

      if (tag === 'input') {
        const type = (activeEl as HTMLInputElement).type.toLowerCase()
        const textInputTypes = ['text', 'search', 'email', 'password', 'number', 'tel', 'url']
        if (textInputTypes.includes(type)) return
      }

      // Non-text UI control: release mouse focus cleanly once interaction finishes
      activeEl.blur()
    }

    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('mouseup', handleGlobalPointerUp)

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
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('mouseup', handleGlobalPointerUp)
    }
  }, [engine])

  return (
    <div className="app font-sans">
      <OfflineBanner />

      {/* Top Performance Dock */}
      <header className="app__bar flex items-center gap-2.5 px-3 py-1 bg-card border border-border rounded-lg shadow-sm">
        {/* Professional Studio Brand Logo Mark & Wordmark */}
        <BrandLogo />

        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant={tuning.sustain ? 'on' : 'outline'}
            size="sm"
            onClick={() => engine.toggleSustain()}
            disabled={!ready}
            title="Toggle Sustain Pedal (Spacebar)"
            className={tuning.sustain ? 'btn--on' : ''}
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
            className="btn--panic"
          >
            Panic
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setIsSettingsOpen(true)
            }}
            title="Open Workstation Settings"
            className="btn gap-1 text-xs"
            data-settings-btn
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <SampleStatus engine={engine} instrumentId={instrumentId} />
          <EngineStatus engine={engine} />
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal engine={engine} isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {tuning.state === 'suspended' && (
        <div className="warn">Audio is paused — click anywhere to enable sound.</div>
      )}
      {bootError && <div className="warn">Startup problem: {bootError}</div>}

      {/* Workstation Tabbed Inspector */}
      <ErrorBoundary name="Workstation Inspector">
        <WorkstationInspector engine={engine} />
      </ErrorBoundary>

      {/* Piano Keyboard Centerpiece Viewport */}
      <main className="app-piano-container flex-1 flex flex-col min-h-[200px]" aria-label="Piano keyboard surface">
        <ErrorBoundary name="Piano Keyboard">
          <PianoKeyboard engine={engine} />
        </ErrorBoundary>
      </main>

      <ErrorBanner />
    </div>
  )
}
