export interface InstrumentInfo {
  id: string
  name: string
  kind: 'synth' | 'samples'
}

/** What the sampler handed back for one note: buffer + playback parameters. */
export interface SampledBuffer {
  buffer: AudioBuffer
  /** Pitch-shift factor for this note (root note -> note). */
  playbackRate: number
  /** Seconds into the sample where sound starts (attack trim). */
  startOffset: number
  /** Optional per-zone gain (dB), applied by the voice envelope. */
  gainDb?: number
}

/**
 * Instrument abstraction. Real multisampled instruments (Phase 3+) implement
 * the same interface — the engine never branches on instrument type.
 */
export interface Instrument {
  readonly info: InstrumentInfo
  /** Optional async preparation, called once before first use. */
  init?(ctx: AudioContext): Promise<void>
  /** Return a buffer + playback parameters usable for this note. */
  getBuffer(ctx: AudioContext, midiNote: number, velocity: number): Promise<SampledBuffer>
  /** Release transient resources; caches may be kept. */
  dispose?(): void
}

export const clampNote = (n: number): number => Math.max(0, Math.min(127, Math.round(n)))

export const midiToFreq = (n: number): number => 440 * Math.pow(2, (n - 69) / 12)
