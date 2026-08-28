import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Harmonium Coupler: Concert Indian Harmonium with Octave Coupler engaged.
 * Combines Bass/Male reeds with clean Octave-higher reed partials
 * for a shimmering, powerful concert harmonium character with 100% pitch stability.
 */
export class HarmoniumCouplerInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'harmonium-coupler',
    name: 'Harmonium Coupler',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateHarmoniumCouplerBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateHarmoniumCouplerBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.2), 1.2, 3.2)
  const dur = clamp(tau * 1.5, 1.4, 3.2)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.018)
  const fadeSamples = Math.floor(sampleRate * 0.01)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t
    const wOct = 2 * Math.PI * (f0 * 2) * t

    // Main reed bank
    const b1 = Math.sin(w0)
    const b2 = Math.sin(w0 * 2) * 0.65
    const b3 = Math.sin(w0 * 3) * 0.45
    const b4 = Math.sin(w0 * 4) * 0.28

    // Octave Coupler reed bank (exact 2x frequency, phase-offset)
    const phC = wOct + 0.25
    const c1 = Math.sin(phC) * 0.70
    const c2 = Math.sin(phC * 2) * 0.45
    const c3 = Math.sin(phC * 3) * 0.28

    const sample = (b1 * 0.35 + b2 * 0.23 + b3 * 0.16 + b4 * 0.10 +
                    c1 * 0.25 + c2 * 0.16 + c3 * 0.10) * 0.52

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
