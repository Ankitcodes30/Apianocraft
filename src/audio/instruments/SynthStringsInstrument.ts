import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * String Ensemble: Lush, warm orchestral string section.
 * 100% pitch-stable overtones with layered harmonic depth and smooth release.
 */
export class SynthStringsInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'string-ensemble',
    name: 'String Ensemble',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateStringsBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateStringsBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.8 * Math.pow(220 / f0, 0.2), 1.5, 3.5)
  const dur = clamp(tau * 1.5, 1.8, 3.5)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.04) // Smooth ensemble attack (40ms)
  const fadeSamples = Math.floor(sampleRate * 0.015)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t

    // Section A (sawtooth-like bowing harmonics)
    const a1 = Math.sin(w0)
    const a2 = Math.sin(w0 * 2) * 0.50
    const a3 = Math.sin(w0 * 3) * 0.30
    const a4 = Math.sin(w0 * 4) * 0.18

    // Section B (phase-offset for ensemble width, identical pitch)
    const phB = w0 + 0.5
    const b1 = Math.sin(phB) * 0.80
    const b2 = Math.sin(phB * 2) * 0.40
    const b3 = Math.sin(phB * 3) * 0.22

    const sample = (a1 * 0.40 + a2 * 0.20 + a3 * 0.12 + a4 * 0.07 +
                    b1 * 0.32 + b2 * 0.16 + b3 * 0.09) * 0.55

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
