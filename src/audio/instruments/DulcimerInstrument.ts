import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Hammered Dulcimer instrument: bright metallic hammer strike on dual-wire strings,
 * resonant metallic decay, and characteristic high shimmer.
 */
export class DulcimerInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'dulcimer',
    name: 'Hammered Dulcimer',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateDulcimerBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateDulcimerBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.8 * Math.pow(220 / f0, 0.35), 0.5, 2.2)
  const dur = clamp(tau * 1.8, 0.8, 2.2)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)
  const detune = Math.pow(2, 2.5 / 1200) // Dual string beating (2.5 cents)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    const w1 = (2 * Math.PI * f0) / sampleRate
    const w2 = (2 * Math.PI * f0 * detune) / sampleRate

    const ph1 = i * w1
    const ph2 = i * w2

    // Metallic hammer transient + dual-wire beating
    const s1 = Math.sin(ph1) + Math.sin(ph1 * 3) * 0.4 + Math.sin(ph1 * 5) * 0.2
    const s2 = Math.sin(ph2) + Math.sin(ph2 * 3) * 0.4 + Math.sin(ph2 * 5) * 0.2

    const sample = (s1 + s2) * 0.5
    const fade = i > n - 300 ? (n - i) / 300 : 1
    data[i] = sample * env * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
