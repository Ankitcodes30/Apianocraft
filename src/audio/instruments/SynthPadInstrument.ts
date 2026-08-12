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
 * Analog Warm Synth Pad procedural instrument: dual detuned sawtooth + triangle
 * oscillators, subtle chorus beating, and low-pass filter attack envelope.
 */
export class SynthPadInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'synth-pad',
    name: 'Synth Pad',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generatePadBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generatePadBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.3), 1.2, 3.5)
  const dur = clamp(tau * 2.2, 1.5, 3.5)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 3241619007)
  const data = new Float32Array(n)

  // Dual detuned oscillators: +4 cents and -4 cents
  const detune1 = Math.pow(2, 4 / 1200)
  const detune2 = Math.pow(2, -4 / 1200)
  const w1 = (2 * Math.PI * f0 * detune1) / sampleRate
  const w2 = (2 * Math.PI * f0 * detune2) / sampleRate
  const wSub = (2 * Math.PI * (f0 / 2)) / sampleRate

  const ph1 = rng() * Math.PI * 2
  const ph2 = rng() * Math.PI * 2
  const attackSamples = Math.floor(sampleRate * 0.15) // Soft pad attack

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    // Soft warm pad attack envelope
    const attack = i < attackSamples ? Math.sin((i / attackSamples) * (Math.PI / 2)) : 1

    // Sawtooth 1 + Sawtooth 2 + Sub Triangle tone
    const saw1 = ((((i * w1 + ph1) / (2 * Math.PI)) % 1) - 0.5) * 2
    const saw2 = ((((i * w2 + ph2) / (2 * Math.PI)) % 1) - 0.5) * 2
    const triSub = Math.abs((((i * wSub) / (2 * Math.PI)) % 1) - 0.5) * 4 - 1

    const sample = saw1 * 0.4 + saw2 * 0.4 + triSub * 0.2
    const fade = i > n - 1000 ? (n - i) / 1000 : 1
    data[i] = sample * env * attack * fade * 0.65
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
