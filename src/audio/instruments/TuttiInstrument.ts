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
 * Orchestral Tutti instrument: full orchestra hit combining brass, strings, octave doubling,
 * and low sub-octave warmth for grand symphonic impact.
 */
export class TuttiInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'tutti',
    name: 'Orchestral Tutti',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateTuttiBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateTuttiBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.2), 1.2, 3.2)
  const dur = clamp(tau * 1.8, 1.5, 3.2)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 999123)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.02) // Tutti orchestral strike

  const fOctLow = f0 * 0.5
  const fOctHigh = f0 * 2.0

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    const w0 = (2 * Math.PI * f0) / sampleRate
    const wLow = (2 * Math.PI * fOctLow) / sampleRate
    const wHigh = (2 * Math.PI * fOctHigh) / sampleRate

    const ph = i * w0 + rng() * 0.02
    const phL = i * wLow
    const phH = i * wHigh

    // Multi-layer orchestral blend: Saw fundamental + octave sub + high string shimmer
    const brass = ((((ph / (2 * Math.PI)) % 1) - 0.5) * 2) * 0.4
    const lowBass = Math.sin(phL) * 0.35
    const highStrings = Math.sin(phH) * 0.25

    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = (brass + lowBass + highStrings) * env * attack * fade * 0.6
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
