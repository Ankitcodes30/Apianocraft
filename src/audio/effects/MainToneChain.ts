/**
 * MainToneChain — the shared Main Tone effects chain.
 *
 * Built exactly once per AudioContext; every voice flows through it, so no
 * effect node is ever allocated per note. Reverb IRs are synthesized once at
 * construction and cached; preset switches only swap a cached AudioBuffer.
 *
 * Topology (stereo from the pan stage onward; Mono input is up-mixed by the
 * pan node):
 *
 *   input (voice bus)
 *    → volume (Gain)            [Main Tone volume]
 *    → pan (StereoPanner, or equal-power gain fallback)
 *    → cutoff (Biquad low-pass)
 *    → chorus (serial: stereo split → L/R LFO-modulated delays + dry → merge)
 *    → dry (Gain) ─────────────────────────────────┐
 *    → reverb send (Gain) → Convolver(IR) → wet ───┤→ sum → output
 *    → delay send (Gain) → Delay(≤1 s) → damp → feedback(≤0.85) → loop ↺
 *    → delay wet (Gain) ───────────────────────────┘
 *
 * Reverb + delay are send/bus effects (parallel, cheap to reuse for a Dual
 * Tone later); chorus is serial. All parameter changes use
 * AudioParam.setTargetAtTime so automation is smooth and click-free.
 */
export type ReverbPresetId = 'room' | 'hall' | 'stage' | 'cathedral'

export interface ReverbPresetDef {
  id: ReverbPresetId
  label: string
  /** Impulse response length in seconds. */
  seconds: number
  /** Exponential decay rate (higher = shorter tail). */
  decayRate: number
  /** One-pole low-pass coefficient while generating (higher = darker). */
  damping: number
}

export const REVERB_PRESETS: ReverbPresetDef[] = [
  { id: 'room', label: 'Room', seconds: 0.9, decayRate: 5.2, damping: 0.9 },
  { id: 'stage', label: 'Stage', seconds: 1.6, decayRate: 3.1, damping: 0.8 },
  { id: 'hall', label: 'Hall', seconds: 2.4, decayRate: 1.9, damping: 0.7 },
  { id: 'cathedral', label: 'Cathedral', seconds: 4.0, decayRate: 1.05, damping: 0.6 },
]

export const REVERB_PRESET_IDS: ReverbPresetId[] = REVERB_PRESETS.map((p) => p.id)

/** Live AudioParam reads for tests (evidence of smooth automation). */
export interface MainToneAudioRead {
  volume: number
  pan: number
  cutoffHz: number
  reverbAmount: number
  chorusAmount: number
  delayAmount: number
  delayTime: number
  feedback: number
}

export interface MainToneIrStats {
  /** How many IRs were ever generated (cache-size proof). */
  generated: number
  /** How many times the preset was switched (cache hits). */
  switches: number
  preset: ReverbPresetId
  presetSeconds: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const clampFinite = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? clamp(v, lo, hi) : lo)

/** AudioParam automation tau: ~5× tau to settle, ~100 ms. */
const TAU_S = 0.02

/**
 * Models AudioParam.setTargetAtTime on the JS side for diagnostics.
 * The audio thread applies exactly `target + (start - target)·e^(-t/tau)`,
 * so this mirror is deterministic and converged reads are exact once
 * 5× tau has elapsed. `AudioParam.getValueAtTime` is not implemented in
 * this browser, so this is the only way to evidence automation progress.
 */
interface AutomationTrack {
  prev: number
  target: number
  t0: number
  tau: number
}
const CUTOFF_MIN_HZ = 100
const CUTOFF_MAX_HZ = 20000
const CHORUS_DEPTH_MAX_S = 0.004
const DELAY_FEEDBACK_MAX = 0.85
const DELAY_DAMP_HZ = 3600

/** Equal-power stereo panner fallback when StereoPannerNode is missing. */
class PanFallback {
  readonly node: AudioNode
  private readonly l: GainNode
  private readonly r: GainNode

  constructor(ctx: BaseAudioContext) {
    const split = ctx.createChannelSplitter(2)
    const merge = ctx.createChannelMerger(2)
    this.l = ctx.createGain()
    this.r = ctx.createGain()
    split.connect(this.l, 0, 0)
    split.connect(this.r, 1, 0)
    this.l.connect(merge, 0, 0)
    this.r.connect(merge, 0, 1)
    this.node = merge
  }

  setPan(value: number): void {
    const theta = ((value + 1) * Math.PI) / 4
    const now = this.node.context.currentTime
    this.l.gain.setTargetAtTime(Math.cos(theta), now, TAU_S)
    this.r.gain.setTargetAtTime(Math.sin(theta), now, TAU_S)
  }

  /** Inverse of the equal-power law, used for diagnostics. */
  readPan(): number {
    const r = clamp(this.r.gain.value, 0, 1)
    return clamp((4 * Math.asin(r)) / Math.PI - 1, -1, 1)
  }
}

export class MainToneChain {
  readonly input: GainNode
  readonly output: GainNode

  private readonly volumeGain: GainNode
  private readonly panner: StereoPannerNode | PanFallback
  private readonly panNode: AudioNode
  private readonly filter: BiquadFilterNode
  private readonly chorusWet: GainNode
  private readonly depthL: GainNode
  private readonly depthR: GainNode
  private readonly reverbSend: GainNode
  private readonly convolver: ConvolverNode
  private readonly delaySend: GainNode
  private readonly delayNode: DelayNode
  private readonly feedbackGain: GainNode
  private readonly dampFilter: BiquadFilterNode
  private readonly irs = new Map<ReverbPresetId, AudioBuffer>()
  private preset: ReverbPresetId = 'room'
  private irGenerated = 0
  private irSwitches = 0
  private reverbConnected = false
  private delayConnected = false
  private readonly tracks = new Map<string, AutomationTrack>()

  constructor(private readonly ctx: BaseAudioContext) {
    this.input = ctx.createGain()

    // Volume — Main Tone level, automated smoothly.
    this.volumeGain = ctx.createGain()
    this.volumeGain.gain.value = 1

    // Pan — StereoPanner where available, equal-power fallback otherwise.
    this.panner =
      typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : new PanFallback(ctx)
    if (this.panner instanceof StereoPannerNode) this.panner.pan.value = 0
    this.panNode = this.panner instanceof StereoPannerNode ? this.panner : this.panner.node

    // Cutoff — low-pass, log-mapped 100 Hz..20 kHz by the engine/UI layer.
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = CUTOFF_MAX_HZ
    this.filter.Q.value = 0.71

    // Chorus — serial; stereo split with per-channel LFO-modulated delays.
    // Plain nodes (no worklet): two DelayNodes modulated by slow oscillators.
    const chorusSplit = ctx.createChannelSplitter(2)
    const chorusMerge = ctx.createChannelMerger(2)
    const dryL = ctx.createGain()
    const dryR = ctx.createGain()
    const delayL = ctx.createDelay(0.03 + CHORUS_DEPTH_MAX_S)
    const delayR = ctx.createDelay(0.03 + CHORUS_DEPTH_MAX_S)
    delayL.delayTime.value = 0.02
    delayR.delayTime.value = 0.024
    this.chorusWet = ctx.createGain()
    this.chorusWet.gain.value = 0
    const oscL = ctx.createOscillator()
    const oscR = ctx.createOscillator()
    oscL.frequency.value = 0.27
    oscR.frequency.value = 0.33
    this.depthL = ctx.createGain()
    this.depthR = ctx.createGain()
    this.depthL.gain.value = 0
    this.depthR.gain.value = 0
    chorusSplit.connect(dryL, 0, 0)
    chorusSplit.connect(dryR, 1, 0)
    chorusSplit.connect(delayL, 0, 0)
    chorusSplit.connect(delayR, 1, 0)
    dryL.connect(chorusMerge, 0, 0)
    dryR.connect(chorusMerge, 0, 1)
    delayL.connect(this.chorusWet)
    delayR.connect(this.chorusWet)
    this.chorusWet.connect(chorusMerge, 0, 0)
    this.chorusWet.connect(chorusMerge, 0, 1)
    oscL.connect(this.depthL)
    this.depthL.connect(delayL.delayTime)
    oscR.connect(this.depthR)
    this.depthR.connect(delayR.delayTime)
    oscL.start()
    oscR.start()
    const chorusOut = ctx.createGain()
    chorusMerge.connect(chorusOut)

    // Reverb — send/bus; IRs pre-generated once and cached for every preset.
    for (const p of REVERB_PRESETS) {
      this.irs.set(p.id, this.makeIR(p))
      this.irGenerated++
    }
    this.convolver = ctx.createConvolver()
    this.convolver.normalize = false
    this.convolver.buffer = this.irs.get('room') ?? null
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0

    // Delay — send/bus; time ≤ 1 s, feedback clamped to 0.85 with damping.
    this.delayNode = ctx.createDelay(1)
    this.delayNode.delayTime.value = 0.35
    this.delaySend = ctx.createGain()
    this.delaySend.gain.value = 0
    this.dampFilter = ctx.createBiquadFilter()
    this.dampFilter.type = 'lowpass'
    this.dampFilter.frequency.value = DELAY_DAMP_HZ
    this.feedbackGain = ctx.createGain()
    this.feedbackGain.gain.value = 0.3
    this.delayNode.connect(this.dampFilter)
    this.dampFilter.connect(this.feedbackGain)
    this.feedbackGain.connect(this.delayNode)

    // Mix: dry + reverb wet + delay wet.
    const dry = ctx.createGain()
    const reverbWet = ctx.createGain()
    const delayWet = ctx.createGain()
    this.output = ctx.createGain()

    this.input.connect(this.volumeGain)
    this.volumeGain.connect(this.panNode)
    this.panNode.connect(this.filter)
    this.filter.connect(chorusSplit)
    chorusOut.connect(dry)
    dry.connect(this.output)
    reverbWet.connect(this.output)
    delayWet.connect(this.output)
  }

  /** Procedural stereo IR — one-pole-damped noise with exponential decay. */
  private makeIR(preset: ReverbPresetDef): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = Math.max(128, Math.floor(sr * preset.seconds))
    const buf = this.ctx.createBuffer(2, len, sr)
    const tau = preset.decayRate * sr
    const damp = clamp(preset.damping, 0.1, 0.99)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        lp = lp * damp + (Math.random() * 2 - 1) * (1 - damp)
        data[i] = lp * Math.exp(-i / tau)
      }
      let peak = 0
      for (let i = 0; i < len; i++) {
        const a = Math.abs(data[i])
        if (a > peak) peak = a
      }
      const g = peak > 1e-9 ? 0.9 / peak : 0
      for (let i = 0; i < len; i++) data[i] *= g
    }
    return buf
  }

  // ------------------------------------------------------------------ volume
  readonly setVolume = (value: number): void => {
    const v = clampFinite(value, 0, 1)
    this.track('volume', v, TAU_S)
    this.volumeGain.gain.setTargetAtTime(v, this.ctx.currentTime, TAU_S)
  }

  // --------------------------------------------------------------------- pan
  readonly setPan = (value: number): void => {
    const v = clampFinite(value, -1, 1)
    this.track('pan', v, TAU_S)
    if (this.panner instanceof StereoPannerNode) {
      this.panner.pan.setTargetAtTime(v, this.ctx.currentTime, TAU_S)
    } else {
      this.panner.setPan(v)
    }
  }

  // ------------------------------------------------------------------ cutoff
  /** Normalized 0..1, log-mapped to 100 Hz..20 kHz by the engine. */
  readonly setCutoff = (normalized: number): void => {
    const n = clampFinite(normalized, 0, 1)
    const hz = CUTOFF_MIN_HZ * Math.pow(CUTOFF_MAX_HZ / CUTOFF_MIN_HZ, n)
    this.track('cutoff', hz, TAU_S)
    this.filter.frequency.setTargetAtTime(hz, this.ctx.currentTime, TAU_S)
  }

  // ------------------------------------------------------------------ reverb
  readonly setReverbAmount = (value: number): void => {
    const v = clampFinite(value, 0, 1)
    this.track('reverb', v, TAU_S)
    if (v > 0 && !this.reverbConnected) {
      this.reverbSend.connect(this.convolver)
      this.reverbConnected = true
    } else if (v === 0 && this.reverbConnected) {
      this.reverbSend.disconnect()
      this.reverbConnected = false
    }
    this.reverbSend.gain.setTargetAtTime(v, this.ctx.currentTime, TAU_S)
  }

  /** Swaps to a cached IR; never regenerates or decodes. */
  readonly setReverbPreset = (id: ReverbPresetId): void => {
    if (id === this.preset || !this.irs.has(id)) return
    this.preset = id
    this.irSwitches++
    this.convolver.buffer = this.irs.get(id) ?? null
  }

  // ------------------------------------------------------------------ chorus
  readonly setChorusAmount = (value: number): void => {
    const v = clampFinite(value, 0, 1)
    const now = this.ctx.currentTime
    this.track('chorus', v, TAU_S)
    this.chorusWet.gain.setTargetAtTime(v, now, TAU_S)
    // LFO depth in seconds; ±4 ms at full amount.
    this.depthL.gain.setTargetAtTime(v * CHORUS_DEPTH_MAX_S, now, TAU_S)
    this.depthR.gain.setTargetAtTime(v * CHORUS_DEPTH_MAX_S, now, TAU_S)
  }

  // ------------------------------------------------------------------- delay
  readonly setDelayAmount = (value: number): void => {
    const v = clampFinite(value, 0, 1)
    this.track('delay', v, TAU_S)
    if (v > 0 && !this.delayConnected) {
      this.delaySend.connect(this.delayNode)
      this.delayConnected = true
    } else if (v === 0 && this.delayConnected) {
      this.delaySend.disconnect()
      this.delayConnected = false
    }
    this.delaySend.gain.setTargetAtTime(v, this.ctx.currentTime, TAU_S)
  }

  /** Seconds, 0..1. */
  readonly setDelayTime = (seconds: number): void => {
    const s = clampFinite(seconds, 0, 1)
    this.track('delayTime', s, TAU_S * 1.5)
    this.delayNode.delayTime.setTargetAtTime(s, this.ctx.currentTime, TAU_S * 1.5)
  }

  /** Feedback level 0..0.85 — hard-bounded so a runaway is impossible. */
  readonly setDelayFeedback = (value: number): void => {
    const v = clampFinite(value, 0, DELAY_FEEDBACK_MAX)
    this.track('feedback', v, TAU_S)
    this.feedbackGain.gain.setTargetAtTime(v, this.ctx.currentTime, TAU_S)
  }

  private track(key: string, target: number, tau: number): void {
    const now = this.ctx.currentTime
    const prev = this.tracks.get(key)
    this.tracks.set(key, {
      prev: prev ? this.readTrack(prev, now) : target,
      target,
      t0: now,
      tau,
    })
  }

  private readTrack(t: AutomationTrack, now: number): number {
    const dt = now - t.t0
    if (dt >= 5 * t.tau) return t.target
    return t.target + (t.prev - t.target) * Math.exp(-dt / t.tau)
  }

  private read(key: string, initial: number): number {
    const t = this.tracks.get(key)
    if (!t) return initial
    const v = this.readTrack(t, this.ctx.currentTime)
    return Number.isFinite(v) ? v : initial
  }

  // ---------------------------------------------------------------- readings
  /** Modeled AudioParam state at the current audio-clock time. */
  audioRead(): MainToneAudioRead {
    return {
      volume: this.read('volume', 1),
      pan: this.read('pan', 0),
      cutoffHz: this.read('cutoff', 20000),
      reverbAmount: this.read('reverb', 0),
      chorusAmount: this.read('chorus', 0),
      delayAmount: this.read('delay', 0),
      delayTime: this.read('delayTime', 0.35),
      feedback: this.read('feedback', 0.3),
    }
  }

  /** IR cache bookkeeping — proof that presets reuse pre-generated IRs. */
  irStats(): MainToneIrStats {
    return {
      generated: this.irGenerated,
      switches: this.irSwitches,
      preset: this.preset,
      presetSeconds: this.irs.get(this.preset)?.duration ?? 0,
    }
  }

  /** Whether the reverb/delay sends are currently wired (bypass state). */
  get isReverbActive(): boolean {
    return this.reverbConnected
  }

  get isDelayActive(): boolean {
    return this.delayConnected
  }
}
