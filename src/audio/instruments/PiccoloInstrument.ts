import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Orchestral Piccolo: High-register woodwind with focused, bright tone.
 * 100% pitch-stable with crisp chiff attack, bright natural harmonics,
 * and smooth, clean release.
 */
export class PiccoloInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'piccolo',
    name: 'Orchestral Piccolo',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generatePiccoloBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generatePiccoloBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.8 * Math.pow(880 / f0, 0.2), 0.8, 2.4)
  const dur = clamp(tau * 1.5, 1.0, 2.4)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.012) // Crisp 12ms attack
  const fadeSamples = Math.floor(sampleRate * 0.008)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t

    // Piccolo overtone series (brighter upper harmonics than flute)
    const h1 = Math.sin(w0)
    const h2 = Math.sin(w0 * 2) * 0.25
    const h3 = Math.sin(w0 * 3) * 0.09
    const h4 = Math.sin(w0 * 4) * 0.03

    // Crisp, short chiff transient (< 10ms)
    const noise = (Math.random() * 2 - 1) * 0.03 * Math.exp(-t / 0.008)

    const sample = (h1 * 0.75 + h2 + h3 + h4 + noise) * 0.6

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
