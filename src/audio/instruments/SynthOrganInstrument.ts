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
 * Tonewheel Organ procedural instrument: 5 drawbar harmonic additive synthesis
 * (Sub 16', Fundamental 8', 5th 5 1/3', Octave 4', 12th 2 2/3') with key click percussion.
 */
export class SynthOrganInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'drawbar-organ',
    name: 'Drawbar Organ',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateOrganBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateOrganBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.0 * Math.pow(220 / f0, 0.3), 1.0, 3.0)
  const dur = clamp(tau * 2.0, 1.2, 3.0)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 88821941)
  const data = new Float32Array(n)

  // Organ drawbar ratios: Sub (0.5), Fundamental (1), 5th (1.4983), Octave (2), 12th (2.9966)
  const ratios = [0.5, 1.0, 1.4983, 2.0, 2.9966]
  const drawbars = [0.6, 1.0, 0.5, 0.7, 0.4]

  const freqs = ratios.map((r) => (2 * Math.PI * f0 * r) / sampleRate)
  const phases = ratios.map(() => rng() * Math.PI * 2)

  const clickDur = Math.floor(sampleRate * 0.003)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    let sample = 0
    for (let k = 0; k < ratios.length; k++) {
      sample += Math.sin(freqs[k] * i + phases[k]) * drawbars[k]
    }
    sample /= 3.2

    // Key click percussive pop
    if (i < clickDur) {
      sample += (rng() * 2 - 1) * (1 - i / clickDur) * 0.25
    }

    const attack = i < sampleRate * 0.002 ? i / (sampleRate * 0.002) : 1
    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = sample * env * attack * fade * 0.6
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
