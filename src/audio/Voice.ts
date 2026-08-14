import type { EnvelopeConfig } from './VoiceManager'

export type VoiceState = 'idle' | 'attack' | 'release'

export interface VoiceStartParams {
  buffer: AudioBuffer
  note: number
  velocity: number
  playbackRate: number
  /** Seconds into the buffer where playback starts (attack trim). */
  startOffset: number
  /** Optional per-zone gain trim (dB). */
  gainDb?: number
  /** Current global pitch bend in cents (-2400..2400), applied at start. */
  pitchBendCents?: number
  /** Optional starting playback rate for portamento glide. */
  portamentoFromRate?: number
  /** Optional portamento glide time in milliseconds. */
  portamentoTimeMs?: number
  out: AudioNode
  env: EnvelopeConfig
  when: number
}

/**
 * One sounding voice: AudioBufferSourceNode + per-voice gain envelope.
 * Created fresh per note (sources are one-shot by design); node churn is
 * cheap and the pool keeps reuse boundaries clean. All envelope timing uses
 * the audio clock (AudioParam automation) — never JS timers. Pitch bend is
 * applied to source.playbackRate as audio-rate automation (setTargetAtTime),
 * so it stays smooth and click-free without rebuilding the voice.
 */
export class Voice {
  state: VoiceState = 'idle'
  midiNote = -1
  velocity = 0
  startedAt = 0
  /** Held by the sustain pedal; release deferred until pedal lift. */
  held = false
  onDone: ((voice: Voice) => void) | null = null

  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  /** Playback rate before any pitch bend (sample root shift * fine tuning). */
  private baseRate = 1
  private bendCents = 0

  constructor(private readonly ctx: BaseAudioContext) {}

  get active(): boolean {
    return this.state !== 'idle'
  }

  /** Effective playback rate: base rate shifted by the current pitch bend. */
  get playbackRate(): number {
    const rate = this.baseRate * Math.pow(2, this.bendCents / 1200)
    return Number.isFinite(rate) && rate > 0 ? rate : 1
  }

  start(p: VoiceStartParams): void {
    const vel = Number.isFinite(p.velocity) ? p.velocity : 0.8
    this.midiNote = p.note
    this.velocity = vel
    this.held = false
    this.baseRate = Number.isFinite(p.playbackRate) && p.playbackRate > 0 ? p.playbackRate : 1
    this.bendCents = Number.isFinite(p.pitchBendCents) ? (p.pitchBendCents ?? 0) : 0
    this.startedAt = performance.now()

    const ctx = this.ctx
    const gain = ctx.createGain()
    const source = ctx.createBufferSource()
    source.buffer = p.buffer

    const targetRate = this.playbackRate
    if (p.portamentoTimeMs && p.portamentoTimeMs > 0 && p.portamentoFromRate && p.portamentoFromRate > 0) {
      const bendFactor = Math.pow(2, this.bendCents / 1200)
      const startRate = p.portamentoFromRate * (Number.isFinite(bendFactor) ? bendFactor : 1)
      source.playbackRate.setValueAtTime(startRate, p.when)
      const timeConstant = (p.portamentoTimeMs / 1000) / 3
      source.playbackRate.setTargetAtTime(targetRate, p.when, Math.max(0.005, timeConstant))
    } else {
      source.playbackRate.value = targetRate
    }

    // Velocity curve + headroom for polyphony; the master limiter catches sums.
    let peak = Math.max(0.02, 0.25 + 0.7 * Math.pow(vel, 1.5))
    if (p.gainDb && Number.isFinite(p.gainDb)) peak *= Math.pow(10, p.gainDb / 20)
    if (!Number.isFinite(peak) || peak <= 0) peak = 0.5

    const attack = Number.isFinite(p.env.attack) ? p.env.attack : 0.005
    const decay = Number.isFinite(p.env.decay) ? p.env.decay : 0.1
    const sustainLevel = Number.isFinite(p.env.sustainLevel) ? p.env.sustainLevel : 0.8

    const attackEnd = p.when + Math.max(0.002, attack)
    gain.gain.setValueAtTime(0.0001, p.when)
    gain.gain.linearRampToValueAtTime(peak, attackEnd)
    gain.gain.setTargetAtTime(Math.max(0.0001, peak * sustainLevel), attackEnd, Math.max(0.01, decay) / 3)

    source.connect(gain)
    gain.connect(p.out)
    source.onended = () => this.handleEnded()
    source.start(p.when, p.startOffset ?? 0)

    this.source = source
    this.gain = gain
    this.state = 'attack'
  }

  /**
   * Smooth, click-free pitch bend: the effective rate ramps toward the target
   * on the audio clock (setTargetAtTime), so rapid bend movement glides
   * instead of stepping. Applies to every sounding phase, including release.
   */
  setPitchBendCents(cents: number, when: number): void {
    if (this.state === 'idle') return
    const bend = Number.isFinite(cents) ? cents : 0
    this.bendCents = bend
    const s = this.source
    if (!s) return
    const target = this.baseRate * Math.pow(2, bend / 1200)
    const targetRate = Number.isFinite(target) && target > 0 ? target : 1
    const startTime = Number.isFinite(when) ? Math.max(when, this.ctx.currentTime) : this.ctx.currentTime
    s.playbackRate.setTargetAtTime(targetRate, startTime, 0.012)
  }

  release(when: number, releaseSeconds: number): void {
    if (this.state === 'idle' || this.state === 'release') return
    this.held = false
    this.state = 'release'
    const g = this.gain
    const s = this.source
    if (!g || !s) {
      this.stopNow()
      return
    }
    const safeWhen = Number.isFinite(when) ? when : this.ctx.currentTime
    const t = Math.max(safeWhen, this.ctx.currentTime + 0.002)
    const rawGain = Number.isFinite(g.gain.value) ? g.gain.value : 0.5
    const v = Math.max(rawGain, 0.0002)
    const relSec = Number.isFinite(releaseSeconds) ? releaseSeconds : 0.3
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.008, relSec))
    s.stop(t + Math.max(0.008, relSec) + 0.05)
  }

  /** Immediate stop used by voice stealing; detaches handler so an async
   *  onended can never corrupt a recycled voice. */
  stopNow(): void {
    if (this.state === 'idle') return
    this.state = 'idle'
    this.detach()
  }

  private handleEnded(): void {
    if (this.state === 'idle') return
    this.state = 'idle'
    this.detach()
    const cb = this.onDone
    this.onDone = null
    cb?.(this)
  }

  private detach(): void {
    const s = this.source
    const g = this.gain
    this.source = null
    this.gain = null
    if (s) {
      s.onended = null
      try {
        s.stop(0)
      } catch {
        /* already stopped or finished */
      }
    }
    if (g) {
      try {
        g.disconnect()
      } catch {
        /* already disconnected */
      }
    }
  }

  dispose(): void {
    this.onDone = null
    if (this.state !== 'idle') {
      this.state = 'idle'
      this.detach()
    }
  }
}
