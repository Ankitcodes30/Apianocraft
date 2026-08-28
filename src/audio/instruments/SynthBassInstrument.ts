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
 * Synth Bass procedural instrument: sub-oscillator sine + low-pass punchy
 * square waveform optimized for deep lower split keyboard performance.
 */
export class SynthBassInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'synth-bass',
    name: 'Synth Bass',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateBassBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateBassBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.5 * Math.pow(220 / f0, 0.4), 0.6, 2.0)
  const dur = clamp(tau * 2.0, 0.8, 2.0)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 123891023)
  const data = new Float32Array(n)

  const w0 = (2 * Math.PI * f0) / sampleRate
  const wSub = (2 * Math.PI * (f0 / 2)) / sampleRate
  const ph0 = rng() * Math.PI * 2

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const filterEnv = Math.exp(-t / (tau * 0.3)) // Filter pop decay

    // Sub-sine + filtered square wave
    const subSine = Math.sin(wSub * i)
    const sq = Math.sin(w0 * i + ph0) >= 0 ? 1 : -1

    const sample = subSine * 0.6 + sq * 0.4 * (0.3 + 0.7 * filterEnv)
    const attack = i < sampleRate * 0.002 ? i / (sampleRate * 0.002) : 1
    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = sample * env * attack * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
