import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Harmonium Sub-Drone: Deep, grounding Indian Harmonium designed specifically
 * for drone and background harmony. Combines fundamental reeds with warm sub-bass
 * partials for a full, resonant drone without boominess.
 */
export class HarmoniumDroneInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'harmonium-drone',
    name: 'Harmonium Sub-Drone',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateHarmoniumDroneBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateHarmoniumDroneBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(3.0 * Math.pow(220 / f0, 0.2), 1.5, 3.5)
  const dur = clamp(tau * 1.5, 1.8, 3.5)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  const attackSamples = Math.floor(sampleRate * 0.035) // Deep air swell
  const fadeSamples = Math.floor(sampleRate * 0.012)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t
    const wSub = 2 * Math.PI * (f0 * 0.5) * t

    // Sub-bass reed bank (0.5x frequency)
    const s1 = Math.sin(wSub) * 0.65
    const s2 = Math.sin(wSub * 2) * 0.45

    // Main reed bank
    const m1 = Math.sin(w0)
    const m2 = Math.sin(w0 * 2) * 0.60
    const m3 = Math.sin(w0 * 3) * 0.40
    const m4 = Math.sin(w0 * 4) * 0.22

    const sample = (m1 * 0.38 + m2 * 0.23 + m3 * 0.15 + m4 * 0.08 +
                    s1 * 0.25 + s2 * 0.17) * 0.50

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
