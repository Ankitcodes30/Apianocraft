import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Bright Concert Grand Piano instrument variant: boosted upper harmonics,
 * crisp hammer attack, and crystalline sustain tone.
 */
export class BrightGrandInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'bright-grand',
    name: 'Bright Grand Piano',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateBrightGrandBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateBrightGrandBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.4), 0.6, 3.5)
  const dur = clamp(tau * 1.8, 1.0, 3.5)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    const w0 = (2 * Math.PI * f0) / sampleRate
    const ph = i * w0

    // Bright piano harmonics: boosted 2nd, 3rd, and 4th overtones
    const h1 = Math.sin(ph)
    const h2 = Math.sin(ph * 2) * 0.75
    const h3 = Math.sin(ph * 3) * 0.5
    const h4 = Math.sin(ph * 4) * 0.35
    const h5 = Math.sin(ph * 5) * 0.2

    const sample = h1 * 0.35 + h2 * 0.28 + h3 * 0.2 + h4 * 0.12 + h5 * 0.05
    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = sample * env * fade * 0.75
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
