import type { AudioEngine } from './audio/AudioEngine'
import type { DiagnosticsSnapshot, MainToneSnapshot, MasterEQState, SampleZoneInfo, SplitZoneSnapshot, WorkstationPreset } from './audio/types'
import type { SampleLoadState } from './audio/samples/types'
import type { MidiManager, MidiStats, MidiSupport } from './midi/MidiManager'
import type { MainToneAudioRead, MainToneIrStats, ReverbPresetId } from './audio/effects/MainToneChain'
import type { NoteBusEvent } from './midi/NoteEventBus'
import { getMidiManager } from './midi/MidiManager'
import { getNoteEventBus } from './midi/NoteEventBus'
import { getQwertyManager } from './keyboard/QwertyManager'
import { detectChord } from './audio/tools/ChordDetector'

export interface MidiDeviceView {
  id: string
  name: string
  connected: boolean
}

export interface TestApi {
  engine: AudioEngine
  noteOn(note: number, velocity?: number): void
  noteOff(note: number): void
  allOff(): void
  chord(count: number, velocity?: number): Promise<DiagnosticsSnapshot>
  rapid(iterations?: number): Promise<DiagnosticsSnapshot>
  rapidGaps(iterations?: number, gapMs?: number): Promise<DiagnosticsSnapshot>
  stress(count?: number): DiagnosticsSnapshot
  sustainOn(): void
  sustainOff(): void
  stats(): DiagnosticsSnapshot
  activeNotes(): number[]
  voices(): { state: string; midiNote: number; velocity: number; held: boolean; ageMs: number; playbackRate: number }[]
  setInstrument(id: string): Promise<void>
  instrumentStatus(id?: string): { status: SampleLoadState['status']; progress: SampleLoadState['progress'] }
  /** Forget all cached sample audio (memory + IndexedDB). */
  clearSampleCache(): Promise<void>
  /** Poll until the sampled instrument reaches the given status. */
  awaitLoad(status: 'ready' | 'error', timeoutMs?: number): Promise<{ ms: number; state: SampleLoadState }>
  /** One note-on/off pair, returning end-to-end and buffer-ready timing. */
  timedNote(note?: number): Promise<DiagnosticsSnapshot>
  /** Fine tuning in cents (-100..+100); shifts playback rate, not zones. */
  setTuningCents(cents: number): void
  /** Which sample zone a note+velocity resolves to (null for synth). */
  zoneFor(note: number, velocity: number): Promise<SampleZoneInfo | null>
  /**
   * Measure the output envelope during release: plays a note, releases it,
   * and returns peak levels sampled every 25ms for `windowMs`. Evidence for
   * click-free releases (monotonic decay, no jumps).
   */
  releaseProfile(note?: number, velocity?: number, holdMs?: number, windowMs?: number): Promise<number[]>
  // ---- Phase 5: MIDI -----------------------------------------------------
  /** The MIDI manager singleton (same instance the UI uses). */
  midi: MidiManager
  /** Current support level: 'unknown' | 'available' | 'unavailable'. */
  midiSupport(): MidiSupport
  /** Connected input devices as seen by the manager. */
  midiDevices(): MidiDeviceView[]
  /** Id of the selected input, or null. */
  midiSelected(): string | null
  /** Select an input by id (null = none). */
  midiSelect(id: string | null): void
  /** Message counters from the MIDI manager. */
  midiStats(): MidiStats
  /** Deliver a raw MIDI message to a mock device (tests only; no-op without the mock). */
  midiSend(deviceId: string, data: number[]): void
  /** Mock hot-plug: connect a device (tests only; no-op without the mock). */
  midiConnect(id: string, name: string): void
  /** Mock hot-plug: disconnect a device (tests only; no-op without the mock). */
  midiDisconnect(id: string): void
  /** Configure the pitch-bend range in semitones (2 or 12). */
  setPitchBendRange(semitones: number): void
  // ---- Phase 6: performance XY pad --------------------------------------
  /** Drive the pad with synthetic pointer events (nx, ny in 0..1; ny 0 = top). */
  perfPadPointer(type: 'down' | 'move' | 'up' | 'cancel', nx: number, ny: number, pointerId?: number): void
  /** Keyboard access on the pad (arrow keys). */
  perfPadKey(type: 'down' | 'up', key: string): void
  /** Pad + engine state snapshot for assertions. */
  perfPadState(): {
    cents: number
    bend: number
    mod: number
    range: number
    dotLeft: string
    dotTop: string
    renders: number
  }
  /** Click the pad's pitch-bend range toggle. */
  perfPadRange(semitones: 2 | 12): void
  // ---- Phase 7: Main Tone controls + effects -----------------------------
  /** Drive a Main Tone slider through the real UI path (input event). */
  mainToneSet(
    kind: 'volume' | 'pan' | 'cutoff' | 'reverb' | 'chorus' | 'delay-amt' | 'delay-time' | 'delay-fb',
    value: number,
  ): void
  /** Pick a reverb preset through the real UI path (change event). */
  mainTonePreset(id: ReverbPresetId): void
  /** Click a Main Tone panel button by selector (octave/transpose/tune). */
  mainToneClick(selector: string): void
  /** Main Tone targets + tuning + UI render counter snapshot. */
  mainToneState(): MainToneSnapshot & {
    octave: number
    transpose: number
    tuning: number
    instrument: string
    renders: number
  }
  /** Live AudioParam reads (automation evidence); null before context. */
  mainToneAudio(): MainToneAudioRead | null
  /** IR cache bookkeeping. */
  mainToneIr(): MainToneIrStats
  /** Whether the reverb/delay sends are currently wired. */
  mainToneActive(): { reverb: boolean; delay: boolean }
  /** Max |sample| measured post-limiter over the window (safety checks). */
  peakOut(ms?: number): Promise<number>
  // ---- Phase 7.5: QWERTY computer keyboard ---------------------------
  /** Last NoteEventBus events from every source (bounded ring). */
  busEvents(): NoteBusEvent[]
  /** Dispatch a keydown/keyup (target defaults to document.body). */
  qwertyKey(
    type: 'down' | 'up',
    key: string,
    opts?: { target?: Element; repeat?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean },
  ): void
  /** QWERTY adapter snapshot: octave, velocity, held keys, panel renders. */
  qwertyState(): { started: boolean; octave: number; velocity: number; heldKeys: string[]; renders: number }
  /** Set the QWERTY-local octave (also reachable via Z/X keys). */
  qwertySetOctave(octave: number): void
  /** Fixed velocity for QWERTY notes. */
  qwertyVelocity(value: number): void
  /** Release all QWERTY-held notes (panic path). */
  qwertyReleaseAll(): void
  /** Simulate window blur (safety release path). */
  qwertyBlur(): void
  /** Override document visibility and dispatch visibilitychange. */
  qwertyVisibility(hidden: boolean): void
  // ---- Phase 8: Dual Tone -----------------------------------------------
  dualToneEnable(enabled: boolean): void
  dualToneInstrument(id: string): Promise<void>
  dualToneSet(
    kind: 'volume' | 'pan' | 'cutoff' | 'reverb' | 'chorus' | 'delay-amt' | 'delay-time' | 'delay-fb',
    value: number,
  ): void
  dualTonePreset(id: ReverbPresetId): void
  dualToneClick(selector: string): void
  dualToneState(): MainToneSnapshot & {
    octave: number
    transpose: number
    tuning: number
    instrument: string
    enabled: boolean
    renders: number
  }
  dualToneAudio(): MainToneAudioRead | null
  dualToneIr(): MainToneIrStats
  dualToneActive(): { reverb: boolean; delay: boolean }
  // ---- Phase 9: Master EQ, Split, & Presets ------------------------------
  masterSetVolume(vol: number): void
  masterSetEQ(low: number, mid: number, high: number): void
  masterGetEQ(): MasterEQState
  splitSetEnabled(enabled: boolean): void
  splitSetPoint(note: number): void
  splitSetLowerInstrument(id: string): Promise<void>
  splitSetLowerOctave(oct: number): void
  splitSetLowerTranspose(tr: number): void
  splitGetState(): SplitZoneSnapshot
  presetGetList(): WorkstationPreset[]
  presetLoad(id: string): Promise<boolean>
  presetSave(name: string): WorkstationPreset
  presetDelete(id: string): boolean
  // ---- Phase 10: Additional Instrument Bank ------------------------------
  getAvailableInstruments(): { id: string; name: string; kind: 'synth' | 'samples' }[]
  // ---- Phase 11: Recording & Transport -----------------------------------
  recordingStart(): void
  recordingStop(): void
  recordingPlay(): void
  recordingClear(): void
  recordingGetSnapshot(): import('./audio/recorder/PerformanceRecorder').TransportSnapshot
  recordingExportMidi(): Uint8Array
  // ---- Phase 12: Workstation Tools (Metronome & Chord Assist) ------------
  metronomeStart(): void
  metronomeStop(): void
  metronomeSetBpm(bpm: number): void
  metronomeGetSnapshot(): import('./audio/tools/Metronome').MetronomeSnapshot
  chordDetectNotes(notes: number[]): import('./audio/tools/ChordDetector').ChordResult | null
  // ---- Phase 13: Production Hardening & PWA Deployment --------------------
  pwaSnapshot(): { onLine: boolean; serviceWorkerSupported: boolean }
}

/** Dev/test hook: lets the audio smoke test drive and inspect the engine. */
export function installTestHarness(engine: AudioEngine): TestApi {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  /** Bounded bus-event ring so tests can assert source/note/velocity. */
  const busLog: NoteBusEvent[] = []
  getNoteEventBus().subscribe((e) => {
    busLog.push(e)
    if (busLog.length > 500) busLog.shift()
  })

  /** Wait until every load and voice has settled, instead of a fixed sleep.
   *  Async sample loads queue serially, so storm duration varies with load. */
  const drain = async (timeoutMs = 6000): Promise<void> => {
    const start = performance.now()
    while (performance.now() - start < timeoutMs) {
      if (!engine.isBusy()) return
      await sleep(100)
    }
  }

  const api: TestApi = {
    engine,
    noteOn: (note, velocity = 0.75) =>
      engine.noteOn({ note, velocity, source: 'programmatic' }),
    noteOff: (note) => engine.noteOff({ note }),
    allOff: () => engine.releaseAll(),
    async chord(count, velocity = 0.75) {
      const base = 48
      for (let i = 0; i < count; i++) {
        engine.noteOn({ note: base + i, velocity, source: 'programmatic' })
      }
      await sleep(350)
      for (let i = 0; i < count; i++) engine.noteOff({ note: base + i })
      await sleep(700)
      return engine.getDiagnostics()
    },
    async rapid(iterations = 300) {
      // Harsh same-task storm: noteOff arrives before the async buffer fetch
      // of the same note resolves. Exercises the pending-off path.
      for (let i = 0; i < iterations; i++) {
        const note = 60 + (i % 24)
        engine.noteOn({ note, velocity: 0.6 + ((i % 5) / 10), source: 'programmatic' })
        engine.noteOff({ note })
      }
      await drain()
      return engine.getDiagnostics()
    },
    async rapidGaps(iterations = 150, gapMs = 6) {
      // Realistic rapid playing: each note gets a task-gap before release.
      // A 4-note cycle (48 ms per note recurrence) guarantees the previous
      // instance of the same note is still in its release tail when it recurs,
      // so the retrigger path fires deterministically under any machine load.
      for (let i = 0; i < iterations; i++) {
        const note = 60 + (i % 4)
        engine.noteOn({ note, velocity: 0.7, source: 'programmatic' })
        await sleep(gapMs)
        engine.noteOff({ note })
        await sleep(gapMs)
      }
      await drain()
      return engine.getDiagnostics()
    },
    stress(count = 32) {
      for (let i = 0; i < count; i++) {
        engine.noteOn({ note: 24 + i, velocity: 0.8, source: 'programmatic' })
      }
      return engine.getDiagnostics()
    },
    sustainOn: () => engine.sustainOn(),
    sustainOff: () => engine.sustainOff(),
    setTuningCents: (cents) => engine.setTuningCents(cents),
    zoneFor: (note, velocity) => engine.sampleZoneFor(note, velocity),
    async releaseProfile(note = 60, velocity = 0.8, holdMs = 150, windowMs = 600) {
      const meter = engine.analyser
      if (!meter) return []
      engine.noteOn({ note, velocity, source: 'programmatic' })
      await sleep(holdMs)
      engine.noteOff({ note })
      const levels: number[] = []
      const buf = new Float32Array(meter.fftSize)
      const t0 = performance.now()
      while (performance.now() - t0 < windowMs) {
        meter.getFloatTimeDomainData(buf)
        let peak = 0
        for (const v of buf) {
          const a = Math.abs(v)
          if (a > peak) peak = a
        }
        levels.push(peak)
        await sleep(25)
      }
      return levels
    },
    stats: () => engine.getDiagnostics(),
    activeNotes: () => [...engine.getActiveNotes()],
    voices: () => engine.getVoiceTable(),
    setInstrument: (id) => engine.setInstrument(id),
    instrumentStatus: () => {
      const d = engine.getDiagnostics()
      const state =
        d.instrumentLoad ?? {
          status: 'idle',
          progress: { loadedFiles: 0, totalFiles: 0, loadedBytes: 0, totalBytes: 0, failedFiles: [] },
        }
      return { status: state.status, progress: state.progress }
    },
    clearSampleCache: () => engine.resetSampleCaches(),
    async awaitLoad(status, timeoutMs = 300000) {
      const start = performance.now()
      while (performance.now() - start < timeoutMs) {
        const d = engine.getDiagnostics()
        if (d.instrumentLoad?.status === status) {
          return { ms: performance.now() - start, state: d.instrumentLoad }
        }
        await sleep(200)
      }
      throw new Error(`Timed out waiting for instrument status "${status}"`)
    },
    async timedNote(note = 60) {
      engine.noteOn({ note, velocity: 0.8, source: 'programmatic' })
      await sleep(80)
      engine.noteOff({ note })
      const t0 = performance.now()
      while (performance.now() - t0 < 8000) {
        if (!engine.isBusy()) return engine.getDiagnostics()
        await sleep(100)
      }
      return engine.getDiagnostics()
    },
    // ---- Phase 5: MIDI ---------------------------------------------------
    midi: getMidiManager(getNoteEventBus()),
    midiSupport: () => getMidiManager(getNoteEventBus()).supportLevel,
    midiDevices: () =>
      getMidiManager(getNoteEventBus())
        .getState()
        .devices.map((d) => ({ id: d.id, name: d.name, connected: d.connected })),
    midiSelected: () => getMidiManager(getNoteEventBus()).selectedId,
    midiSelect: (id) => getMidiManager(getNoteEventBus()).selectInput(id),
    midiStats: () => getMidiManager(getNoteEventBus()).getStats(),
    midiSend: (deviceId, data) => {
      const mock = (window as unknown as { __midiMock?: { send(id: string, d: number[]): void } }).__midiMock
      mock?.send(deviceId, data)
    },
    midiConnect: (id, name) => {
      const mock = (window as unknown as { __midiMock?: { connect(id: string, name: string): void } }).__midiMock
      mock?.connect(id, name)
    },
    midiDisconnect: (id) => {
      const mock = (window as unknown as { __midiMock?: { disconnect(id: string): void } }).__midiMock
      mock?.disconnect(id)
    },
    setPitchBendRange: (semitones) => engine.setPitchBendRange(semitones),
    // ---- Phase 6: performance XY pad -----------------------------------
    perfPadPointer: (type, nx, ny, pointerId = 1) => {
      const pad = document.querySelector('[data-perf-pad]')
      if (!pad) return
      const r = pad.getBoundingClientRect()
      const nativeType = type === 'down' ? 'pointerdown' : type === 'move' ? 'pointermove' : type === 'up' ? 'pointerup' : 'pointercancel'
      pad.dispatchEvent(
        new PointerEvent(nativeType, {
          pointerId,
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientX: r.left + nx * r.width,
          clientY: r.top + ny * r.height,
          buttons: type === 'up' || type === 'cancel' ? 0 : 1,
        }),
      )
    },
    perfPadKey: (type, key) => {
      const pad = document.querySelector('[data-perf-pad]')
      if (!pad) return
      pad.dispatchEvent(new KeyboardEvent(type === 'down' ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }))
    },
    perfPadState: () => {
      const dot = document.querySelector('[data-perf-dot]')
      const d = engine.getDiagnostics()
      const w = window as unknown as { __apiano?: { perfPadRenders?: { count: number } } }
      return {
        cents: d.pitchBendCents,
        bend: d.pitchBend,
        mod: d.modulation,
        range: d.pitchBendRange,
        dotLeft: dot instanceof HTMLElement ? dot.style.left : '',
        dotTop: dot instanceof HTMLElement ? dot.style.top : '',
        renders: w.__apiano?.perfPadRenders?.count ?? -1,
      }
    },
    perfPadRange: (semitones) => {
      const pad = document.querySelector('[data-perf-pad]')
      const button = pad?.querySelector(`[data-bend-range="${semitones}"]`)
      if (button instanceof HTMLElement) button.click()
    },
    // ---- Phase 7: Main Tone controls + effects -------------------------
    mainToneSet: (kind, value) => {
      const sel = {
        volume: '[data-vol]',
        pan: '[data-pan]',
        cutoff: '[data-cutoff]',
        reverb: '[data-reverb]',
        chorus: '[data-chorus]',
        'delay-amt': '[data-delay-amt]',
        'delay-time': '[data-delay-time]',
        'delay-fb': '[data-delay-fb]',
      }[kind]
      const el = document.querySelector(sel)
      if (!(el instanceof HTMLInputElement)) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(value))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    mainTonePreset: (id) => {
      const el = document.querySelector('[data-reverb-preset]')
      if (!(el instanceof HTMLSelectElement)) return
      el.value = id
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    mainToneClick: (selector) => {
      const el = document.querySelector(selector)
      if (el instanceof HTMLElement) el.click()
    },
    mainToneState: () => {
      const d = engine.getDiagnostics()
      const w = window as unknown as { __apiano?: { mainToneRenders?: { count: number } } }
      return {
        ...(d.mainTone ?? {
          volume: 1,
          pan: 0,
          cutoffNorm: 1,
          cutoffHz: 20000,
          reverbAmount: 0,
          reverbPreset: 'room',
          chorusAmount: 0,
          delayAmount: 0,
          delayTime: 0.35,
          delayFeedback: 0.3,
        }),
        octave: d.octaveShift,
        transpose: d.transpose,
        tuning: d.tuningCents,
        instrument: d.instrument,
        renders: w.__apiano?.mainToneRenders?.count ?? -1,
      }
    },
    mainToneAudio: () => engine.mainToneAudioRead(),
    mainToneIr: () => engine.mainToneIrStats() ?? { generated: 0, switches: 0, preset: 'room', presetSeconds: 0 },
    mainToneActive: () => engine.mainToneActive(),
    async peakOut(ms = 400) {
      const meter = engine.outputAnalyser
      if (!meter) return -1
      const buf = new Float32Array(meter.fftSize)
      let peak = 0
      const t0 = performance.now()
      while (performance.now() - t0 < ms) {
        meter.getFloatTimeDomainData(buf)
        for (const v of buf) {
          const a = Math.abs(v)
          if (a > peak) peak = a
        }
        await sleep(10)
      }
      return peak
    },
    // ---- Phase 7.5: QWERTY computer keyboard ---------------------------
    busEvents: () => [...busLog],
    qwertyKey: (type, key, opts = {}) => {
      const target = opts.target ?? document.body
      target.dispatchEvent(
        new KeyboardEvent(type === 'down' ? 'keydown' : 'keyup', {
          key,
          repeat: Boolean(opts.repeat),
          ctrlKey: Boolean(opts.ctrl),
          altKey: Boolean(opts.alt),
          metaKey: Boolean(opts.meta),
          shiftKey: Boolean(opts.shift),
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    qwertyState: () => {
      const s = getQwertyManager(getNoteEventBus()).getState()
      const w = window as unknown as { __apiano?: { qwertyRenders?: { count: number } } }
      return { ...s, renders: w.__apiano?.qwertyRenders?.count ?? -1 }
    },
    qwertySetOctave: (octave) => getQwertyManager(getNoteEventBus()).setOctave(octave),
    qwertyVelocity: (value) => getQwertyManager(getNoteEventBus()).setVelocity(value),
    qwertyReleaseAll: () => getQwertyManager(getNoteEventBus()).releaseAll(),
    qwertyBlur: () => window.dispatchEvent(new Event('blur')),
    qwertyVisibility: (hidden) => {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    },
    // ---- Phase 8: Dual Tone -----------------------------------------------
    dualToneEnable: (enabled) => engine.setDualToneEnabled(enabled),
    dualToneInstrument: (id) => engine.setDualInstrument(id),
    dualToneSet: (kind, value) => {
      const sel = {
        volume: '[data-dual-vol]',
        pan: '[data-dual-pan]',
        cutoff: '[data-dual-cutoff]',
        reverb: '[data-dual-reverb]',
        chorus: '[data-dual-chorus]',
        'delay-amt': '[data-dual-delay-amt]',
        'delay-time': '[data-dual-delay-time]',
        'delay-fb': '[data-dual-delay-fb]',
      }[kind]
      const el = document.querySelector(sel)
      if (!(el instanceof HTMLInputElement)) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(value))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    dualTonePreset: (id) => {
      const el = document.querySelector('[data-dual-reverb-preset]')
      if (!(el instanceof HTMLSelectElement)) return
      el.value = id
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    dualToneClick: (selector) => {
      const el = document.querySelector(selector)
      if (el instanceof HTMLElement) el.click()
    },
    dualToneState: () => {
      const d = engine.getDiagnostics()
      const w = window as unknown as { __apiano?: { dualToneRenders?: { count: number } } }
      return {
        ...(d.dualTone ?? {
          volume: 1,
          pan: 0,
          cutoffNorm: 1,
          cutoffHz: 20000,
          reverbAmount: 0,
          reverbPreset: 'room',
          chorusAmount: 0,
          delayAmount: 0,
          delayTime: 0.35,
          delayFeedback: 0.3,
        }),
        octave: d.dualOctaveShift ?? 0,
        transpose: d.dualTranspose ?? 0,
        tuning: d.dualTuningCents ?? 0,
        instrument: d.dualInstrument ?? 'grand-piano',
        enabled: d.dualEnabled ?? false,
        renders: w.__apiano?.dualToneRenders?.count ?? -1,
      }
    },
    dualToneAudio: () => engine.dualToneAudioRead(),
    dualToneIr: () => engine.dualToneIrStats() ?? { generated: 0, switches: 0, preset: 'room', presetSeconds: 0 },
    dualToneActive: () => engine.dualToneActive(),
    // ---- Phase 9: Master EQ, Split, & Presets ------------------------------
    masterSetVolume: (vol) => engine.setMasterVolume(vol),
    masterSetEQ: (low, mid, high) => {
      engine.setMasterEqLow(low)
      engine.setMasterEqMid(mid)
      engine.setMasterEqHigh(high)
    },
    masterGetEQ: () => engine.masterEQState(),
    splitSetEnabled: (enabled) => engine.setSplitEnabled(enabled),
    splitSetPoint: (note) => engine.setSplitPoint(note),
    splitSetLowerInstrument: (id) => engine.setLowerInstrument(id),
    splitSetLowerOctave: (oct) => engine.setLowerOctaveShift(oct),
    splitSetLowerTranspose: (tr) => engine.setLowerTranspose(tr),
    splitGetState: () => engine.splitZoneState(),
    presetGetList: () => engine.getPresets(),
    presetLoad: (id) => engine.loadPreset(id),
    presetSave: (name) => engine.saveUserPreset(name),
    presetDelete: (id) => engine.deleteUserPreset(id),
    // ---- Phase 10: Additional Instrument Bank ------------------------------
    getAvailableInstruments: () => engine.getInstruments(),
    // ---- Phase 11: Recording & Transport -----------------------------------
    recordingStart: () => engine.startRecording(),
    recordingStop: () => engine.stopRecording(),
    recordingPlay: () => engine.startPlayback(),
    recordingClear: () => engine.clearRecording(),
    recordingGetSnapshot: () => engine.getRecorderSnapshot(),
    recordingExportMidi: () => engine.exportMidi(),
    // ---- Phase 12: Workstation Tools (Metronome & Chord Assist) ------------
    metronomeStart: () => engine.startMetronome(),
    metronomeStop: () => engine.stopMetronome(),
    metronomeSetBpm: (bpm) => engine.setMetronomeBpm(bpm),
    metronomeGetSnapshot: () => engine.getMetronomeSnapshot(),
    chordDetectNotes: (notes) => detectChord(notes),
    // ---- Phase 13: Production Hardening & PWA Deployment --------------------
    pwaSnapshot: () => ({
      onLine: navigator.onLine,
      serviceWorkerSupported: 'serviceWorker' in navigator,
    }),
  }

  // Merge, never replace: other modules (e.g. PianoKeyboard) may already have
  // attached test hooks to window.__apiano.
  const w = window as unknown as { __apiano?: Record<string, unknown> }
  const existing = w.__apiano ?? {}
  w.__apiano = { ...existing, ...api }
  return api
}
