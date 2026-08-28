import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Concert Flute: Pure, sweet acoustic woodwind character.
 * 100% pitch-stable fundamental with soft, natural 2nd & 3rd harmonics,
 * gentle chiff breath attack, and smooth, clean release.
 */
export class FluteInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'flute',
    name: 'Concert Flute',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateFluteBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateFluteBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.2 * Math.pow(440 / f0, 0.2), 1.2, 3.0)
  const dur = clamp(tau * 1.5, 1.2, 3.0)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.02) // Gentle 20ms attack
  const fadeSamples = Math.floor(sampleRate * 0.01) // Clean 10ms end fade

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability (zero warble/siren pitch drift)
    const w0 = 2 * Math.PI * f0 * t

    // Pure acoustic flute harmonic series (dominant fundamental)
    const h1 = Math.sin(w0)
    const h2 = Math.sin(w0 * 2) * 0.12
    const h3 = Math.sin(w0 * 3) * 0.03
    const h4 = Math.sin(w0 * 4) * 0.01

    // Very subtle 4.5Hz amplitude tremolo (volume swell, zero pitch modulation)
    const tremolo = 1 + 0.02 * Math.sin(2 * Math.PI * 4.5 * t) * Math.min(1, Math.max(0, (t - 0.15) * 3))

    // Soft initial breath chiff noise transient (< 15ms)
    const noise = (Math.random() * 2 - 1) * 0.02 * Math.exp(-t / 0.012)

    const sample = (h1 * 0.8 + h2 + h3 + h4 + noise) * tremolo * 0.65

    // Smooth release fade-out to prevent any end-of-note clicks or tail artifacts
    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
