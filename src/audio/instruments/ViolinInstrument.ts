import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Violin Solo: Warm, expressive bowed string character.
 * 100% pitch-stable fundamental with natural bowed string overtones,
 * organic bow-grip attack, and smooth release.
 */
export class ViolinInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'violin',
    name: 'Violin Solo',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateViolinBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateViolinBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.4 * Math.pow(440 / f0, 0.2), 1.2, 3.2)
  const dur = clamp(tau * 1.5, 1.2, 3.2)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.028) // Natural bow onset (28ms)
  const fadeSamples = Math.floor(sampleRate * 0.012)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t

    // Acoustic bowed-string harmonic series (warm sawtooth spectrum)
    const h1 = Math.sin(w0)
    const h2 = Math.sin(w0 * 2) * 0.55
    const h3 = Math.sin(w0 * 3) * 0.35
    const h4 = Math.sin(w0 * 4) * 0.22
    const h5 = Math.sin(w0 * 5) * 0.14
    const h6 = Math.sin(w0 * 6) * 0.08

    // Rosin attack friction (< 20ms)
    const rosin = (Math.random() * 2 - 1) * 0.02 * Math.exp(-t / 0.018)

    // Gentle amplitude warmth swell (volume, zero pitch wobble)
    const warmth = 1 + 0.025 * Math.sin(2 * Math.PI * 5.0 * t) * Math.min(1, Math.max(0, (t - 0.1) * 2))

    const sample = (h1 * 0.45 + h2 * 0.25 + h3 * 0.15 + h4 * 0.1 + h5 * 0.05 + h6 * 0.03 + rosin) * warmth * 0.6

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
