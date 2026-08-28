import { Voice } from './Voice'

export interface EnvelopeConfig {
  /** seconds to full gain */
  attack: number
  /** seconds of decay toward sustain level */
  decay: number
  /** 0..1 steady-state level relative to peak */
  sustainLevel: number
  /** seconds for release ramp */
  release: number
}

export interface VoiceManagerCallbacks {
  onEnded(note: number): void
  onChanged(): void
}

export interface VoiceManagerDeps {
  ctx: BaseAudioContext
  bus: AudioNode
  env: EnvelopeConfig
  /** Dynamic cap so the engine can adapt polyphony on weak devices. */
  getMaxVoices(): number
  callbacks: VoiceManagerCallbacks
}

export interface VoiceManagerStats {
  created: number
  active: number
  sustained: number
  /** Highest simultaneous active-voice count ever observed. */
  peakActive: number
  steals: number
  dropped: number
  retriggers: number
  maxVoices: number
}

/**
 * Voice pool with adaptive cap and intelligent stealing:
 * release-phase voices first, then sustain-held, then longest-sounding.
 * Note layers (dual tone etc.) will count through this same manager.
 */
export class VoiceManager {
  private pool: Voice[] = []
  private active = new Set<Voice>()
  private peakActive = 0
  private steals = 0
  private dropped = 0
  private retriggers = 0

  constructor(private readonly deps: VoiceManagerDeps) {}

  get activeCount(): number {
    return this.active.size
  }

  get stats(): VoiceManagerStats {
    let sustained = 0
    for (const v of this.active) if (v.held) sustained++
    return {
      created: this.pool.length,
      active: this.active.size,
      sustained,
      peakActive: this.peakActive,
      steals: this.steals,
      dropped: this.dropped,
      retriggers: this.retriggers,
      maxVoices: this.deps.getMaxVoices(),
    }
  }

  /** Per-voice state table for diagnostics/tests (not on the audio path). */
  get voiceTable(): { state: string; midiNote: number; velocity: number; held: boolean; ageMs: number; playbackRate: number }[] {
    const now = performance.now()
    const out: { state: string; midiNote: number; velocity: number; held: boolean; ageMs: number; playbackRate: number }[] = []
    for (const v of this.pool) {
      if (v.active) {
        out.push({
          state: v.state,
          midiNote: v.midiNote,
          velocity: v.velocity,
          held: v.held,
          ageMs: Math.round(now - v.startedAt),
          playbackRate: Math.round(v.playbackRate * 10000) / 10000,
        })
      }
    }
    return out
  }

  start(
    buffer: AudioBuffer,
    note: number,
    velocity: number,
    opts: {
      playbackRate?: number
      startOffset?: number
      gainDb?: number
      env?: Partial<EnvelopeConfig>
      pitchBendCents?: number
      portamentoFromRate?: number
      portamentoTimeMs?: number
      out?: AudioNode
    } = {},
  ): boolean {
    const voice = this.acquire()
    if (!voice) {
      this.dropped++
      this.deps.callbacks.onChanged()
      return false
    }
    this.active.add(voice)
    if (this.active.size > this.peakActive) this.peakActive = this.active.size
    voice.onDone = (v) => {
      this.active.delete(v)
      this.deps.callbacks.onEnded(v.midiNote)
      this.deps.callbacks.onChanged()
    }
    voice.start({
      buffer,
      note,
      velocity,
      playbackRate: opts.playbackRate ?? 1,
      startOffset: opts.startOffset ?? 0,
      gainDb: opts.gainDb,
      pitchBendCents: opts.pitchBendCents,
      portamentoFromRate: opts.portamentoFromRate,
      portamentoTimeMs: opts.portamentoTimeMs,
      out: opts.out ?? this.deps.bus,
      env: { ...this.deps.env, ...opts.env },
      when: this.deps.ctx.currentTime + 0.004,
    })
    this.deps.callbacks.onChanged()
    return true
  }

  /** Apply a global pitch bend (cents) to every sounding voice. */
  setPitchBend(cents: number, when: number): void {
    if (this.active.size === 0) return
    for (const v of this.active) v.setPitchBendCents(cents, when)
  }

  /** Returns the number of voices touched. */
  noteOff(note: number, sustain: boolean, releaseSeconds?: number): number {
    let n = 0
    for (const v of this.active) {
      if (v.midiNote === note && v.state !== 'release') {
        if (sustain) {
          v.held = true
          n++
        } else {
          v.release(this.deps.ctx.currentTime, releaseSeconds ?? this.deps.env.release)
          n++
        }
      }
    }
    if (n) this.deps.callbacks.onChanged()
    return n
  }

  /** Mark all sounding instances of a note as sustain-held. */
  markHeld(note: number): void {
    for (const v of this.active) {
      if (v.midiNote === note && v.state !== 'release') v.held = true
    }
  }

  sustainReleaseAll(): void {
    let changed = false
    const now = this.deps.ctx.currentTime
    for (const v of this.active) {
      if (v.held) {
        v.held = false
        v.release(now, this.deps.env.release)
        changed = true
      }
    }
    if (changed) this.deps.callbacks.onChanged()
  }

  /** Same-note retrigger: fast-release any sounding instance of the note. */
  retrigger(note: number, releaseSeconds: number): number {
    let n = 0
    const now = this.deps.ctx.currentTime
    for (const v of this.active) {
      if (v.midiNote === note) {
        v.release(now, releaseSeconds)
        n++
      }
    }
    if (n) {
      this.retriggers += n
      this.deps.callbacks.onChanged()
    }
    return n
  }

  releaseAll(): void {
    const now = this.deps.ctx.currentTime
    for (const v of this.active) v.release(now, this.deps.env.release)
    this.deps.callbacks.onChanged()
  }

  private acquire(): Voice | null {
    for (const v of this.pool) if (!v.active) return v
    if (this.pool.length < this.deps.getMaxVoices()) {
      const v = new Voice(this.deps.ctx)
      this.pool.push(v)
      return v
    }
    const victim = this.pickVictim()
    if (!victim) return null
    this.steals++
    victim.stopNow()
    this.active.delete(victim)
    this.deps.callbacks.onEnded(victim.midiNote)
    this.deps.callbacks.onChanged()
    return victim
  }

  private pickVictim(): Voice | null {
    let best: Voice | null = null
    let bestScore = Infinity
    const now = performance.now()
    for (const v of this.active) {
      const score = v.state === 'release' ? 0 : v.held ? 1 : 2 + (now - v.startedAt)
      if (score < bestScore) {
        bestScore = score
        best = v
      }
    }
    return best
  }

  dispose(): void {
    for (const v of this.pool) v.dispose()
    this.pool = []
    this.active.clear()
  }
}
