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
 * Saxophone instrument: warm Tenor/Alto sax timbre with rich reed harmonics,
 * subtle breath noise, and expressive pitch vibrato.
 */
export class SaxophoneInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'saxophone',
    name: 'Saxophone',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateSaxophoneBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateSaxophoneBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.0 * Math.pow(220 / f0, 0.25), 0.9, 2.5)
  const dur = clamp(tau * 1.8, 1.0, 2.5)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 314159)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.02) // Reed onset attack
  const vibRate = 4.8 // Hz sax vibrato
  const vibDepth = 0.004

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1
    const vibrato = 1 + Math.sin(2 * Math.PI * vibRate * t) * vibDepth * Math.min(1, t * 1.5)

    const w0 = (2 * Math.PI * f0 * vibrato) / sampleRate
    const ph = i * w0

    // Saxophone reed harmonics (odd + strong even harmonics for rich body)
    const h1 = Math.sin(ph)
    const h2 = Math.sin(ph * 2) * 0.6
    const h3 = Math.sin(ph * 3) * 0.45
    const h4 = Math.sin(ph * 4) * 0.25
    const noise = (rng() - 0.5) * 0.03 * Math.exp(-t * 8) // breath onset transient

    const sample = h1 * 0.45 + h2 * 0.3 + h3 * 0.18 + h4 * 0.07 + noise
    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = sample * env * attack * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
