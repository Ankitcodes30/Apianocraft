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
 * Solo Trumpet instrument: bright, focused brass timbre with characteristic
 * odd/even harmonic spectrum, fast attack, and slight vibrato swell.
 */
export class TrumpetInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'trumpet',
    name: 'Trumpet Solo',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateTrumpetBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateTrumpetBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.6 * Math.pow(220 / f0, 0.25), 0.7, 2.2)
  const dur = clamp(tau * 1.8, 0.9, 2.2)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 773821)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.015) // Crisp trumpet attack
  const vibRate = 5.2 // Hz vibrato
  const vibDepth = 0.003 // pitch variation

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1
    const vibrato = 1 + Math.sin(2 * Math.PI * vibRate * t) * vibDepth * Math.min(1, t * 2)

    const w0 = (2 * Math.PI * f0 * vibrato) / sampleRate
    const ph = i * w0 + rng() * 0.01

    // Trumpet harmonic series (strong fundamental + 2nd, 3rd, 4th, 5th overtones)
    const h1 = Math.sin(ph)
    const h2 = Math.sin(ph * 2) * 0.7
    const h3 = Math.sin(ph * 3) * 0.5
    const h4 = Math.sin(ph * 4) * 0.35
    const h5 = Math.sin(ph * 5) * 0.2

    const sample = h1 * 0.4 + h2 * 0.28 + h3 * 0.2 + h4 * 0.14 + h5 * 0.08
    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = sample * env * attack * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
