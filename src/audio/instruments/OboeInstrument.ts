import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Oboe instrument: double-reed woodwind timbre with prominent upper harmonics,
 * focused formant resonance, and delicate vibrato swell.
 */
export class OboeInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'oboe',
    name: 'Oboe',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateOboeBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateOboeBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.8 * Math.pow(220 / f0, 0.25), 0.8, 2.4)
  const dur = clamp(tau * 1.8, 1.0, 2.4)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.03) // Soft double-reed attack
  const vibRate = 5.5 // Hz vibrato
  const vibDepth = 0.003

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1
    const vibrato = 1 + Math.sin(2 * Math.PI * vibRate * t) * vibDepth * Math.min(1, t * 2)

    const w0 = (2 * Math.PI * f0 * vibrato) / sampleRate
    const ph = i * w0

    // Oboe double-reed harmonics (strong 3rd, 4th, 5th harmonics giving nasal reed quality)
    const h1 = Math.sin(ph) * 0.35
    const h2 = Math.sin(ph * 2) * 0.35
    const h3 = Math.sin(ph * 3) * 0.5
    const h4 = Math.sin(ph * 4) * 0.3
    const h5 = Math.sin(ph * 5) * 0.15

    const sample = h1 + h2 + h3 + h4 + h5
    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = sample * env * attack * fade * 0.65
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
