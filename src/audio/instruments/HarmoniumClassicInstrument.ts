import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Harmonium Classic: Warm, balanced, traditional Indian Harmonium.
 * Features dual free-reed partial banks (Bass + Male reeds), rich odd & even overtones,
 * 100% pitch stability, natural bellows attack, and clean release.
 */
export class HarmoniumClassicInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'harmonium-classic',
    name: 'Harmonium Classic',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateHarmoniumClassicBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateHarmoniumClassicBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.2), 1.2, 3.2)
  const dur = clamp(tau * 1.5, 1.4, 3.2)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.02) // Bellows air pressure onset
  const fadeSamples = Math.floor(sampleRate * 0.01)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t

    // Free-reed harmonic series (Bass reed bank)
    const b1 = Math.sin(w0)
    const b2 = Math.sin(w0 * 2) * 0.70
    const b3 = Math.sin(w0 * 3) * 0.48
    const b4 = Math.sin(w0 * 4) * 0.32
    const b5 = Math.sin(w0 * 5) * 0.20
    const b6 = Math.sin(w0 * 6) * 0.12

    // Male reed bank (phase-offset for reed thickness difference, identical pitch)
    const phM = w0 + 0.35
    const m1 = Math.sin(phM) * 0.85
    const m2 = Math.sin(phM * 2) * 0.60
    const m3 = Math.sin(phM * 3) * 0.42
    const m4 = Math.sin(phM * 4) * 0.28
    const m5 = Math.sin(phM * 5) * 0.18

    const sample = (b1 * 0.35 + b2 * 0.25 + b3 * 0.17 + b4 * 0.11 + b5 * 0.07 + b6 * 0.04 +
                    m1 * 0.30 + m2 * 0.21 + m3 * 0.15 + m4 * 0.10 + m5 * 0.06) * 0.55

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
