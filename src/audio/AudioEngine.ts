import { AudioEngineError } from './errors'
import { Limiter } from './effects/Limiter'
import { MainToneChain, REVERB_PRESET_IDS } from './effects/MainToneChain'
import type { MainToneAudioRead, MainToneIrStats, ReverbPresetId } from './effects/MainToneChain'
import { SynthInstrument } from './instruments/SynthInstrument'
import { InstrumentBank } from './instruments/InstrumentBank'
import { SampleInstrument } from './samples/SampleInstrument'
import type { SampleLoadState } from './samples/types'
import { VoiceManager, type EnvelopeConfig } from './VoiceManager'
import { clampNote } from './instruments/Instrument'
import type { DiagnosticsSnapshot, EngineEvent, EngineListener, InputSource, LimiterKind, MainToneSnapshot, NoteOnRequest, SampleZoneInfo } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const clampFinite = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? clamp(v, lo, hi) : lo)

/** Fixed lead (ms) between scheduling and audio-clock start. */
const SCHEDULING_LEAD_MS = 4

/**
 * AudioEngine — completely independent of React. One persistent AudioContext,
 * all timing on the audio clock, UI subscribes to events (active notes, state)
 * and polls diagnostics; React never drives or waits on audio timing.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private limiter: Limiter | null = null
  private mainTone: MainToneChain | null = null
  private mainToneInitMs = 0
  private outputMeter: AnalyserNode | null = null
  private voiceManager: VoiceManager | null = null
  private bank = new InstrumentBank()
  private listeners = new Set<EngineListener>()

  private activeNotes = new Set<number>()
  private meter: AnalyserNode | null = null
  private noteCounts = new Map<number, number>()
  private pendingLoads = 0
  private spawnsInFlight = new Map<number, number>()
  private pendingOffs = new Set<number>()

  private transpose = 0
  private octaveShift = 0
  private tuningOffset = 0
  private sustainPedal = false
  private instrument = 'demo-piano'
  private pitchBend = 0
  private pitchBendCents = 0
  private pitchBendRange = 2
  private modulation = 0

  private baseCap = 64
  private polyphonyCap = 64
  private lastAdaptAt = 0
  private lastSteals = 0
  private lastDropped = 0
  private totalStarted = 0
  private totalStopped = 0
  private limiterKind: LimiterKind = 'none'
  private envConfig: EnvelopeConfig = { attack: 0.004, decay: 0.25, sustainLevel: 0.8, release: 0.3 }

  private createdFlag = false
  private createPromise: Promise<void> | null = null

  private noteTiming = { sumBufferReadyMs: 0, count: 0, maxBufferReadyMs: 0, lastBufferReadyMs: 0, lastStartMs: 0 }
  private midiTiming = { count: 0, sumSchedulingMs: 0, lastSchedulingMs: 0, maxSchedulingMs: 0 }

  /** Main Tone effect targets (engine-tracked so reads are deterministic). */
  private mainToneTargets: MainToneSnapshot = {
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
  }

  get isCreated(): boolean {
    return this.createdFlag
  }

  get state(): AudioContextState | 'closed' {
    return this.ctx ? this.ctx.state : 'closed'
  }

  get activeInstrument(): string {
    return this.bank.get(this.instrument)?.info.name ?? this.instrument
  }

  get instrumentId(): string {
    return this.instrument
  }

  get transposeSemitones(): number {
    return this.transpose
  }

  get octave(): number {
    return this.octaveShift
  }

  get sustainEnabled(): boolean {
    return this.sustainPedal
  }

  /** One persistent context, built lazily on first user gesture. */
  async create(): Promise<void> {
    if (this.createdFlag) return
    if (this.createPromise) return this.createPromise
    this.createPromise = this.doCreate().finally(() => {
      this.createPromise = null
    })
    return this.createPromise
  }

  private async doCreate(): Promise<void> {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      throw new AudioEngineError(
        'WEB_AUDIO_UNSUPPORTED',
        'This browser does not support the Web Audio API, which Apianocraft needs to produce sound.',
      )
    }
    let ctx: AudioContext
    try {
      ctx = new Ctor({ latencyHint: 'interactive' })
    } catch (cause) {
      throw new AudioEngineError('CONTEXT_CREATE_FAILED', 'Could not initialize the audio engine.', cause)
    }
    this.ctx = ctx
    this.createdFlag = true

    // Voice bus -> master -> meter (tap) -> limiter -> destination
    const instrumentBus = ctx.createGain()
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.8
    const meter = ctx.createAnalyser()
    meter.fftSize = 512
    meter.smoothingTimeConstant = 0.25
    this.meter = meter
    masterGain.connect(meter)

    this.limiter = await Limiter.create(ctx)
    this.limiterKind = this.limiter.kind
    const limiterNode = this.limiter.node
    masterGain.connect(limiterNode)
    limiterNode.connect(ctx.destination)

    // Post-limiter tap for safety metering (read-only, passes no audio).
    const outMeter = ctx.createAnalyser()
    outMeter.fftSize = 2048
    limiterNode.connect(outMeter)
    this.outputMeter = outMeter

    // Shared Main Tone chain: one per context, every voice flows through it.
    const t0 = performance.now()
    this.mainTone = new MainToneChain(ctx)
    this.mainToneInitMs = performance.now() - t0
    instrumentBus.connect(this.mainTone.input)
    this.mainTone.output.connect(masterGain)
    this.applyMainToneTargets()

    // Adaptive polyphony: generous cap scaled by CPU count, halved on pressure.
    this.baseCap = Math.min(64, Math.max(8, (navigator.hardwareConcurrency ?? 4) * 16))
    this.polyphonyCap = this.baseCap

    this.voiceManager = new VoiceManager({
      ctx,
      bus: instrumentBus,
      env: this.envConfig,
      getMaxVoices: () => this.polyphonyCap,
      callbacks: {
        onEnded: (note) => {
          this.totalStopped++
          this.noteEnded(note)
        },
        onChanged: () => {
          /* reserved for future live hooks */
        },
      },
    })

    this.bank.register(new SynthInstrument())
    this.registerSampleInstrument('grand-piano')

    ctx.addEventListener('statechange', () => {
      this.emit({ type: 'state', state: ctx.state })
    })
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.unlock()
    })

    this.emit({ type: 'state', state: ctx.state })
    void this.unlock()
  }

  /** Call from user gestures; resumes a suspended context (autoplay policy). */
  async unlock(): Promise<void> {
    const ctx = this.ctx
    if (!ctx) return
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (cause) {
        this.reportError(
          new AudioEngineError(
            'RESUME_FAILED',
            'The audio engine could not be started. Click the page to allow audio playback.',
            cause,
          ),
        )
      }
    }
    if (ctx.state === 'running') this.emit({ type: 'state', state: ctx.state })
  }

  /**
   * Input -> engine path. No React involved. Transpose + octave are applied
   * here so every input source (mouse, QWERTY, MIDI) is automatically tuned.
   */
  noteOn(req: NoteOnRequest): void {
    const ctx = this.ctx
    if (!ctx || !this.voiceManager) return
    if (ctx.state !== 'running') {
      void this.unlock()
      return
    }
    const effective = this.applyTuning(req.note)
    this.voiceManager.retrigger(effective, this.envConfig.release * 0.25)
    const velocity = clamp(req.velocity, 0, 1)
    void this.spawnVoice(effective, velocity, req.source)
  }

  noteOff(req: { note: number }): void {
    const ctx = this.ctx
    if (!ctx || !this.voiceManager || ctx.state !== 'running') return
    const effective = this.applyTuning(req.note)
    const released = this.voiceManager.noteOff(effective, this.sustainPedal)
    // Key released before its sample was ready: remember so the voice can be
    // cut short (or sustain-held) the moment it starts.
    if (released === 0 && (this.spawnsInFlight.get(effective) ?? 0) > 0) {
      this.pendingOffs.add(effective)
    }
  }

  releaseAll(): void {
    this.voiceManager?.releaseAll()
  }

  sustainOn(): void {
    this.sustainPedal = true
    this.emit({ type: 'tuning' })
  }

  sustainOff(): void {
    this.sustainPedal = false
    this.voiceManager?.sustainReleaseAll()
    this.emit({ type: 'tuning' })
  }

  toggleSustain(): void {
    if (this.sustainPedal) this.sustainOff()
    else this.sustainOn()
  }

  setTranspose(semitones: number): void {
    this.transpose = clamp(Math.round(semitones), -12, 12)
    this.emit({ type: 'tuning' })
  }

  setOctaveShift(octaves: number): void {
    this.octaveShift = clamp(Math.round(octaves), -5, 5)
    this.emit({ type: 'tuning' })
  }

  /** Fine tuning in cents (-100..+100). Shifts playback rate, not note/zone mapping. */
  get tuningCents(): number {
    return this.tuningOffset
  }

  setTuningCents(cents: number): void {
    this.tuningOffset = clamp(Math.round(cents), -100, 100)
    this.emit({ type: 'tuning' })
  }

  resetTuning(): void {
    this.transpose = 0
    this.octaveShift = 0
    this.tuningOffset = 0
    this.emit({ type: 'tuning' })
  }

  /** Pitch bend value, normalized -1..1 (0 = center). */
  get pitchBendValue(): number {
    return this.pitchBend
  }

  /** Current applied pitch bend in cents. */
  get pitchBendCentsValue(): number {
    return this.pitchBendCents
  }

  /** Pitch-bend range in semitones (2 or 12). */
  get pitchBendRangeSemitones(): number {
    return this.pitchBendRange
  }

  /**
   * Apply a global pitch bend (normalized -1..1). Every sounding voice is
   * retuned on the audio clock (AudioParam automation) — no voice rebuilds,
   * so movement is smooth and click-free. No engine event is emitted here:
   * the UI learns bend position from throttled MIDI activity instead, so
   * bend messages never trigger React renders.
   */
  setPitchBend(value: number): void {
    this.pitchBend = clamp(value, -1, 1)
    this.pitchBendCents = this.pitchBend * this.pitchBendRange * 100
    const vm = this.voiceManager
    const ctx = this.ctx
    if (vm && ctx) vm.setPitchBend(this.pitchBendCents, ctx.currentTime)
  }

  setPitchBendRange(semitones: number): void {
    this.pitchBendRange = semitones >= 12 ? 12 : 2
    this.setPitchBend(this.pitchBend)
  }

  /** Modulation wheel value, normalized 0..1. Exposed for future vibrato /
   *  filter effects; currently no audio effect is applied. */
  get modulationValue(): number {
    return this.modulation
  }

  setModulation(value: number): void {
    this.modulation = clamp(value, 0, 1)
  }

  // ---- Phase 7: Main Tone controls + effects -----------------------------
  // All changes go straight to shared AudioParam automation on the audio
  // clock. Nothing here allocates effect nodes or rebuilds voices, and no
  // engine event is emitted (the UI polls a throttled snapshot instead), so
  // slider movement never triggers React renders.

  setMainToneVolume(value: number): void {
    const v = clampFinite(value, 0, 1)
    this.mainToneTargets.volume = v
    this.mainTone?.setVolume(v)
  }

  setMainTonePan(value: number): void {
    const v = clampFinite(value, -1, 1)
    this.mainToneTargets.pan = v
    this.mainTone?.setPan(v)
  }

  /** Normalized 0..1; log-mapped to 100 Hz..20 kHz inside the chain. */
  setMainToneCutoff(normalized: number): void {
    const n = clampFinite(normalized, 0, 1)
    this.mainToneTargets.cutoffNorm = n
    this.mainToneTargets.cutoffHz = Math.round(100 * Math.pow(200, n))
    this.mainTone?.setCutoff(n)
  }

  setMainToneReverbAmount(value: number): void {
    const v = clampFinite(value, 0, 1)
    this.mainToneTargets.reverbAmount = v
    this.mainTone?.setReverbAmount(v)
  }

  setMainToneReverbPreset(id: string): void {
    if (!REVERB_PRESET_IDS.includes(id as ReverbPresetId)) return
    this.mainToneTargets.reverbPreset = id as ReverbPresetId
    this.mainTone?.setReverbPreset(id as ReverbPresetId)
  }

  setMainToneChorusAmount(value: number): void {
    const v = clampFinite(value, 0, 1)
    this.mainToneTargets.chorusAmount = v
    this.mainTone?.setChorusAmount(v)
  }

  setMainToneDelayAmount(value: number): void {
    const v = clampFinite(value, 0, 1)
    this.mainToneTargets.delayAmount = v
    this.mainTone?.setDelayAmount(v)
  }

  /** Seconds, 0..1 (0-1000 ms). */
  setMainToneDelayTime(seconds: number): void {
    const s = clampFinite(seconds, 0, 1)
    this.mainToneTargets.delayTime = s
    this.mainTone?.setDelayTime(s)
  }

  /** 0..0.85 — hard-bounded so runaway feedback is impossible. */
  setMainToneDelayFeedback(value: number): void {
    const v = clampFinite(value, 0, 0.85)
    this.mainToneTargets.delayFeedback = v
    this.mainTone?.setDelayFeedback(v)
  }

  /** Current Main Tone targets (deterministic engine-side view). */
  mainToneState(): MainToneSnapshot {
    return { ...this.mainToneTargets }
  }

  /** Live AudioParam reads (automation-progress evidence for tests). */
  mainToneAudioRead(): MainToneAudioRead | null {
    return this.mainTone?.audioRead() ?? null
  }

  /** IR cache bookkeeping (proof that presets reuse pre-generated IRs). */
  mainToneIrStats(): MainToneIrStats | null {
    return this.mainTone?.irStats() ?? null
  }

  /** Whether the reverb/delay sends are wired (bypass state). */
  mainToneActive(): { reverb: boolean; delay: boolean } {
    return {
      reverb: this.mainTone?.isReverbActive ?? false,
      delay: this.mainTone?.isDelayActive ?? false,
    }
  }

  /** Post-limiter analyser for safety metering (read-only). */
  get outputAnalyser(): AnalyserNode | null {
    return this.outputMeter
  }

  /**
   * Render-thread progress: total samples processed by the limiter worklet.
   * Analyser buffers can go stale when rendering stalls; this cannot.
   */
  limiterClock(): number {
    return this.limiter?.clock() ?? 0
  }

  /**
   * Render-thread ground truth for metering: the worklet reports each
   * 1024-sample window's peak amplitude at its exact render position.
   */
  limiterLevel(): { samples: number; peak: number } {
    return this.limiter?.level() ?? { samples: 0, peak: 0 }
  }

  private applyMainToneTargets(): void {
    const t = this.mainToneTargets
    const c = this.mainTone
    if (!c) return
    c.setVolume(t.volume)
    c.setPan(t.pan)
    c.setCutoff(t.cutoffNorm)
    c.setReverbAmount(t.reverbAmount)
    c.setReverbPreset(t.reverbPreset)
    c.setChorusAmount(t.chorusAmount)
    c.setDelayAmount(t.delayAmount)
    c.setDelayTime(t.delayTime)
    c.setDelayFeedback(t.delayFeedback)
  }

  async setInstrument(id: string): Promise<void> {
    if (id === this.instrument) return
    if (this.ctx) {
      await this.bank.ensureInit(this.ctx, id).catch((cause) => {
        this.reportError(
          new AudioEngineError(
            'INSTRUMENT_LOAD_FAILED',
            `Instrument "${id}" failed to load: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          ),
        )
      })
    }
    this.instrument = id
    this.emit({ type: 'load', instrumentId: id, state: this.sampleState(id) })
  }

  /** Retry a failed instrument load (e.g. after a network blip). */
  reloadInstrument(id: string = this.instrument): void {
    const instrument = this.bank.get(id)
    if (instrument instanceof SampleInstrument) {
      instrument.retry()
      this.emit({ type: 'load', instrumentId: id, state: instrument.getState() })
    }
  }

  /** Forget all cached sample audio (memory + IndexedDB). For tests / reload. */
  async resetSampleCaches(): Promise<void> {
    const reset = [...this.bank.list()].map((info) => this.bank.get(info.id)).filter(
      (i): i is SampleInstrument => i instanceof SampleInstrument,
    )
    await Promise.all(reset.map((i) => i.resetCache()))
  }

  /** Instruments available to the UI. */
  getInstruments(): { id: string; name: string; kind: 'synth' | 'samples' }[] {
    return this.bank.list()
  }

  /** Current load state for a sampled instrument (idle for synth instruments). */
  getInstrumentLoadState(id: string): SampleLoadState {
    return this.sampleState(id)
  }

  private registerSampleInstrument(id: string): void {
    const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'
    const samplesBase = `${base}${base.endsWith('/') ? '' : '/'}samples/`
    this.bank.register(
      new SampleInstrument({
        id,
        defUrl: `${samplesBase}${id}/manifest.json`,
        samplesBaseUrl: samplesBase,
        onLoadState: (state) => {
          this.emit({ type: 'load', instrumentId: id, state })
        },
      }),
    )
  }

  private sampleState(id: string): SampleLoadState {
    const instrument = this.bank.get(id)
    if (instrument instanceof SampleInstrument) return instrument.getState()
    return { status: 'idle', progress: { loadedFiles: 0, totalFiles: 0, loadedBytes: 0, totalBytes: 0, failedFiles: [] } }
  }

  getActiveNotes(): ReadonlySet<number> {
    return this.activeNotes
  }

  /** True while samples are still loading or voices are sounding. */
  isBusy(): boolean {
    return this.pendingLoads > 0 || (this.voiceManager?.activeCount ?? 0) > 0
  }

  /** Per-voice state table for diagnostics (never on the audio path). */
  getVoiceTable(): { state: string; midiNote: number; velocity: number; held: boolean; ageMs: number; playbackRate: number }[] {
    return this.voiceManager?.voiceTable ?? []
  }

  /** Live output analyser (read-only) for test/UI metering. */
  get analyser(): AnalyserNode | null {
    return this.meter
  }

  /**
   * Resolve which sample zone a note+velocity maps to on the current
   * instrument. Diagnostic hook for velocity-layer tests; returns null
   * for synth instruments or before the manifest is ready.
   */
  async sampleZoneFor(note: number, velocity: number): Promise<SampleZoneInfo | null> {
    const ctx = this.ctx
    const instrument = this.bank.get(this.instrument)
    if (!ctx || !(instrument instanceof SampleInstrument)) return null
    try {
      const zone = await instrument.resolveZone(note, clamp(velocity, 0, 1))
      if (!zone) return null
      return {
        note,
        velocity: clamp(velocity, 0, 1),
        zone: zone.sample,
        sample: zone.sample,
        rootNote: zone.rootNote,
        minNote: zone.loNote,
        maxNote: zone.hiNote,
        minVelocity: zone.velLo,
        maxVelocity: zone.velHi,
        gainDb: zone.gainDb,
        tune: zone.tune,
      }
    } catch {
      return null
    }
  }

  getDiagnostics(): DiagnosticsSnapshot {
    this.adapt()
    const ctx = this.ctx
    const vm = this.voiceManager
    const stats = vm?.stats
    const instrument = this.bank.get(this.instrument)
    const sampled = instrument instanceof SampleInstrument ? instrument : undefined
    const timing = this.noteTiming
    return {
      contextState: ctx?.state ?? 'closed',
      sampleRate: ctx?.sampleRate ?? 0,
      baseLatencyMs: ctx ? Math.round((ctx.baseLatency + (ctx.outputLatency ?? 0)) * 1000 * 100) / 100 : 0,
      activeVoices: stats?.active ?? 0,
      sustainedVoices: stats?.sustained ?? 0,
      peakActiveVoices: stats?.peakActive ?? 0,
      totalStarted: this.totalStarted,
      totalStopped: this.totalStopped,
      steals: stats?.steals ?? 0,
      dropped: stats?.dropped ?? 0,
      retriggers: stats?.retriggers ?? 0,
      pendingLoads: this.pendingLoads,
      poolSize: stats?.created ?? 0,
      polyphonyCap: stats?.maxVoices ?? 0,
      limiter: this.limiterKind,
      instrument: this.activeInstrument,
      transpose: this.transpose,
      octaveShift: this.octaveShift,
      tuningCents: this.tuningOffset,
      sustain: this.sustainPedal,
      pitchBend: this.pitchBend,
      pitchBendCents: this.pitchBendCents,
      pitchBendRange: this.pitchBendRange,
      modulation: this.modulation,
      instrumentLoad: sampled?.getState(),
      sampleCache: sampled?.cacheStats,
      noteTiming: {
        lastBufferReadyMs: Math.round(timing.lastBufferReadyMs * 100) / 100,
        avgBufferReadyMs: timing.count > 0 ? Math.round((timing.sumBufferReadyMs / timing.count) * 100) / 100 : 0,
        maxBufferReadyMs: Math.round(timing.maxBufferReadyMs * 100) / 100,
        lastStartMs: Math.round(timing.lastStartMs * 100) / 100,
        schedulingLeadMs: SCHEDULING_LEAD_MS,
      },
      midiTiming: {
        count: this.midiTiming.count,
        lastSchedulingMs: Math.round(this.midiTiming.lastSchedulingMs * 100) / 100,
        avgSchedulingMs:
          this.midiTiming.count > 0
            ? Math.round((this.midiTiming.sumSchedulingMs / this.midiTiming.count) * 100) / 100
            : 0,
        maxSchedulingMs: Math.round(this.midiTiming.maxSchedulingMs * 100) / 100,
        audioClockLeadMs: SCHEDULING_LEAD_MS,
      },
      mainTone: this.mainTone ? { ...this.mainToneTargets } : undefined,
      mainToneInitMs: this.mainToneInitMs,
    }
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async dispose(): Promise<void> {
    this.voiceManager?.releaseAll()
    await new Promise((r) => setTimeout(r, 400))
    this.voiceManager?.dispose()
    this.voiceManager = null
    this.mainTone = null
    this.outputMeter = null
    const ctx = this.ctx
    if (ctx && ctx.state !== 'closed') await ctx.close()
    this.ctx = null
    this.createdFlag = false
    this.listeners.clear()
  }

  private async spawnVoice(note: number, velocity: number, source: InputSource): Promise<void> {
    const ctx = this.ctx
    const vm = this.voiceManager
    if (!ctx || !vm) return
    this.pendingLoads++
    this.spawnsInFlight.set(note, (this.spawnsInFlight.get(note) ?? 0) + 1)
    const inputAt = performance.now()
    try {
      const sampled = await this.bank.getBuffer(ctx, this.instrument, note, velocity)
      const bufferReadyMs = performance.now() - inputAt
      this.noteTiming.lastBufferReadyMs = bufferReadyMs
      this.noteTiming.sumBufferReadyMs += bufferReadyMs
      this.noteTiming.count++
      this.noteTiming.maxBufferReadyMs = Math.max(this.noteTiming.maxBufferReadyMs, bufferReadyMs)
      if (ctx.state !== 'running') return
      const tuningFactor = Math.pow(2, this.tuningOffset / 1200)
      if (vm.start(sampled.buffer, note, velocity, {
        playbackRate: sampled.playbackRate * tuningFactor,
        startOffset: sampled.startOffset,
        gainDb: sampled.gainDb,
        pitchBendCents: this.pitchBendCents,
      })) {
        this.noteTiming.lastStartMs = performance.now() - inputAt
        if (source === 'midi') {
          const ms = performance.now() - inputAt
          this.midiTiming.count++
          this.midiTiming.lastSchedulingMs = ms
          this.midiTiming.sumSchedulingMs += ms
          this.midiTiming.maxSchedulingMs = Math.max(this.midiTiming.maxSchedulingMs, ms)
        }
        this.totalStarted++
        this.noteStarted(note)
        if (this.pendingOffs.has(note)) {
          // The key was released before the sample was ready: release right
          // away with a short tail, or hold it if the sustain pedal is down.
          vm.noteOff(note, this.sustainPedal, 0.03)
        }
      }
    } catch (cause) {
      this.reportError(
        new AudioEngineError(
          'INSTRUMENT_LOAD_FAILED',
          `Instrument "${this.instrument}" failed to load: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        ),
      )
    } finally {
      this.pendingLoads--
      const c = (this.spawnsInFlight.get(note) ?? 1) - 1
      if (c <= 0) {
        this.spawnsInFlight.delete(note)
        this.pendingOffs.delete(note)
      } else {
        this.spawnsInFlight.set(note, c)
      }
    }
  }

  private applyTuning(note: number): number {
    return clampNote(note + this.transpose + this.octaveShift * 12)
  }

  private noteStarted(note: number): void {
    const c = (this.noteCounts.get(note) ?? 0) + 1
    this.noteCounts.set(note, c)
    if (c === 1) {
      this.activeNotes.add(note)
      this.emit({ type: 'active-notes', notes: this.activeNotes })
    }
  }

  private noteEnded(note: number): void {
    const c = (this.noteCounts.get(note) ?? 1) - 1
    if (c <= 0) {
      this.noteCounts.delete(note)
      this.activeNotes.delete(note)
      this.emit({ type: 'active-notes', notes: this.activeNotes })
    } else {
      this.noteCounts.set(note, c)
    }
  }

  /**
   * Adaptive polyphony, polled from getDiagnostics (off the audio path).
   * Uses delta counters so the cap can recover once pressure subsides:
   * halved under recent drops/steals, doubled back when healthy.
   */
  private adapt(): void {
    const vm = this.voiceManager
    if (!vm) return
    const now = performance.now()
    if (now - this.lastAdaptAt < 2500) return
    const s = vm.stats
    const newSteals = s.steals - this.lastSteals
    const newDropped = s.dropped - this.lastDropped
    this.lastSteals = s.steals
    this.lastDropped = s.dropped
    this.lastAdaptAt = now
    if (newDropped > 0 || newSteals > 2) {
      if (this.polyphonyCap > 8) this.polyphonyCap = Math.max(8, this.polyphonyCap >> 1)
    } else if (this.polyphonyCap < this.baseCap) {
      this.polyphonyCap = Math.min(this.baseCap, this.polyphonyCap * 2)
    }
  }

  private reportError(error: AudioEngineError): void {
    console.error('[apianocraft]', error.message)
    this.emit({ type: 'error', error })
  }

  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }
}

let instance: AudioEngine | null = null

/** Module singleton: survives React StrictMode remounts, one context total. */
export function getEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}
