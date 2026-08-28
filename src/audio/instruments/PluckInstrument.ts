import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Pluck instrument: crisp acoustic/synth plucked string with instant transient attack,
 * bright initial body, and exponential damping.
 */
export class PluckInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'pluck',
    name: 'Acoustic Pluck',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generatePluckBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generatePluckBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.2 * Math.pow(220 / f0, 0.4), 0.3, 1.8)
  const dur = clamp(tau * 2.0, 0.6, 2.0)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    const w0 = (2 * Math.PI * f0) / sampleRate
    const ph = i * w0

    // Plucked string harmonics (exponentially damped overtones for natural string body)
    const h1 = Math.sin(ph) * Math.exp(-t / tau)
    const h2 = Math.sin(ph * 2) * 0.5 * Math.exp(-t / (tau * 0.6))
    const h3 = Math.sin(ph * 3) * 0.3 * Math.exp(-t / (tau * 0.35))
    const h4 = Math.sin(ph * 4) * 0.15 * Math.exp(-t / (tau * 0.2))

    const sample = h1 + h2 + h3 + h4
    const fade = i > n - 300 ? (n - i) / 300 : 1
    data[i] = sample * env * fade * 0.75
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
