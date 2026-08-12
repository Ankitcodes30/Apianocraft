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
 * String Ensemble procedural instrument: multi-voice detuned string section
 * with gentle bow attack and lush harmonic sustain.
 */
export class SynthStringsInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'string-ensemble',
    name: 'String Ensemble',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateStringsBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateStringsBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.8 * Math.pow(220 / f0, 0.3), 1.5, 4.0)
  const dur = clamp(tau * 2.0, 1.8, 4.0)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 555121921)
  const data = new Float32Array(n)

  // 3 detuned string voices (+6c, 0c, -6c)
  const detunes = [Math.pow(2, 6 / 1200), 1.0, Math.pow(2, -6 / 1200)]
  const freqs = detunes.map((d) => (2 * Math.PI * f0 * d) / sampleRate)
  const phases = detunes.map(() => rng() * Math.PI * 2)

  const attackSamples = Math.floor(sampleRate * 0.12) // Bow attack

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    const attack = i < attackSamples ? Math.sin((i / attackSamples) * (Math.PI / 2)) : 1

    let sample = 0
    for (let k = 0; k < freqs.length; k++) {
      const saw = ((((i * freqs[k] + phases[k]) / (2 * Math.PI)) % 1) - 0.5) * 2
      const oct = ((((i * freqs[k] * 2 + phases[k]) / (2 * Math.PI)) % 1) - 0.5) * 2
      sample += saw * 0.35 + oct * 0.15
    }
    sample /= 1.5

    const fade = i > n - 1000 ? (n - i) / 1000 : 1
    data[i] = sample * env * attack * fade * 0.6
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
