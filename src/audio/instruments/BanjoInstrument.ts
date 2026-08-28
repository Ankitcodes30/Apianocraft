import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 5-String Banjo Instrument: Metallic plucked timbre featuring sharp plectrum attack,
 * bright metallic overtones, rapid decay, and characteristic banjo twang.
 */
export class BanjoInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'banjo',
    name: '5-String Banjo',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateBanjoBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateBanjoBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(0.9 * Math.pow(220 / f0, 0.3), 0.4, 1.8) // Fast banjo pluck decay
  const dur = clamp(tau * 1.8, 0.7, 1.8)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 66191)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.005) // Sharp pick transient

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    const w0 = (2 * Math.PI * f0) / sampleRate
    const ph = i * w0 + rng() * 0.01

    // Metallic string harmonics + bridge twang resonance
    const h1 = Math.sin(ph)
    const h2 = Math.sin(ph * 2) * 0.85
    const h3 = Math.sin(ph * 3) * 0.7
    const h4 = Math.sin(ph * 4) * 0.5
    const h5 = Math.sin(ph * 5) * 0.35
    const h6 = Math.sin(ph * 6) * 0.2

    // Drumhead skin body resonance at 650Hz
    const skinRes = Math.sin(2 * Math.PI * 650 * t) * 0.15 * Math.exp(-t / 0.08)

    // Sharp pick transient
    const pickNoise = (rng() * 2 - 1) * 0.2 * Math.exp(-t / 0.008)

    const sample = (h1 * 0.4 + h2 * 0.3 + h3 * 0.2 + h4 * 0.12 + h5 * 0.08 + h6 * 0.05 + skinRes + pickNoise) * 0.65
    const fade = i > n - 350 ? (n - i) / 350 : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
