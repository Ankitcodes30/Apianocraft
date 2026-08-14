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
 * Brass Section instrument: full multi-layer brass ensemble (horns, trombones, trumpets)
 * with detuned sawtooth & square layering, punchy attack, and rich resonance.
 */
export class BrassSectionInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'brass-section',
    name: 'Brass Section',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateBrassSectionBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateBrassSectionBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.2 * Math.pow(220 / f0, 0.2), 1.0, 2.8)
  const dur = clamp(tau * 1.8, 1.2, 2.8)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 881923)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.025) // Brass swell attack

  const detunes = [1.0, Math.pow(2, 4 / 1200), Math.pow(2, -5 / 1200), Math.pow(2, 7 / 1200)]
  const phases = detunes.map(() => rng() * Math.PI * 2)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    let mix = 0
    for (let d = 0; d < detunes.length; d++) {
      const w = (2 * Math.PI * f0 * detunes[d]) / sampleRate
      const ph = i * w + phases[d]
      const saw = ((((ph / (2 * Math.PI)) % 1) - 0.5) * 2)
      mix += saw * 0.25
    }

    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = mix * env * attack * fade * 0.65
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
