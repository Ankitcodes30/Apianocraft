import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Warm Felt Grand Piano instrument variant: smooth fundamental focus,
 * mellow felt hammer strike, and long warm resonance.
 */
export class WarmGrandInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'warm-grand',
    name: 'Warm Felt Grand',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateWarmGrandBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateWarmGrandBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(3.0 * Math.pow(220 / f0, 0.4), 0.8, 4.0)
  const dur = clamp(tau * 1.8, 1.2, 4.0)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    const w0 = (2 * Math.PI * f0) / sampleRate
    const ph = i * w0

    // Warm felt harmonics: dominant fundamental, rapidly decaying high overtones
    const h1 = Math.sin(ph)
    const h2 = Math.sin(ph * 2) * 0.35 * Math.exp(-t * 2)
    const h3 = Math.sin(ph * 3) * 0.15 * Math.exp(-t * 4)

    const sample = h1 * 0.7 + h2 * 0.2 + h3 * 0.1
    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = sample * env * fade * 0.75
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
