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
 * Synth Brass procedural instrument: bright sawtooth stack with dynamic filter
 * envelope pop and punchy brass swell.
 */
export class SynthBrassInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'synth-brass',
    name: 'Synth Brass',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateBrassBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateBrassBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.8 * Math.pow(220 / f0, 0.3), 0.8, 2.5)
  const dur = clamp(tau * 2.0, 1.0, 2.5)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 99182377)
  const data = new Float32Array(n)

  const detune1 = Math.pow(2, 3 / 1200)
  const detune2 = Math.pow(2, -3 / 1200)
  const w1 = (2 * Math.PI * f0 * detune1) / sampleRate
  const w2 = (2 * Math.PI * f0 * detune2) / sampleRate

  const ph1 = rng() * Math.PI * 2
  const ph2 = rng() * Math.PI * 2
  const attackSamples = Math.floor(sampleRate * 0.02) // Punchy brass swell attack

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    const saw1 = ((((i * w1 + ph1) / (2 * Math.PI)) % 1) - 0.5) * 2
    const saw2 = ((((i * w2 + ph2) / (2 * Math.PI)) % 1) - 0.5) * 2

    const sample = saw1 * 0.5 + saw2 * 0.5
    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = sample * env * attack * fade * 0.65
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
