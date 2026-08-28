import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Saxophone Lead: Expressive solo saxophone lead.
 * Features warm reed overtones, woody body resonance, velocity-layered attack chiff & sub-tone dynamics,
 * delayed expressive amplitude vibrato, 100% pitch stability, and smooth release.
 */
export class SaxophoneInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'saxophone',
    name: 'Saxophone Lead',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number, velocity: number = 0.8): Promise<SampledBuffer> {
    const vel = clamp(velocity, 0.1, 1.0)
    const velBand = clamp(Math.floor(vel * 4), 0, 3)
    const key = `${midiNote}_v${velBand}`

    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateSaxophoneLeadBuffer(ctx, midiNote, velBand)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateSaxophoneLeadBuffer(ctx: AudioContext, midiNote: number, velBand: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.2 * Math.pow(220 / f0, 0.25), 1.0, 2.8)
  const dur = clamp(tau * 1.5, 1.2, 2.8)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  // Velocity-layered attack times: quiet notes have smooth sub-tone onset; loud notes have crisp chiff
  const attackMs = [0.035, 0.026, 0.020, 0.014][velBand]
  const attackSamples = Math.floor(sampleRate * attackMs)
  const fadeSamples = Math.floor(sampleRate * 0.012)

  // Velocity-layered reed harmonic scale & attack chiff
  const upperScale = [0.30, 0.55, 0.80, 1.10][velBand]
  const chiffAmp = [0.005, 0.012, 0.022, 0.035][velBand]

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Strict phase: 100% pitch stability
    const w0 = 2 * Math.PI * f0 * t

    // Saxophone reed harmonics (strong fundamental + prominent odd reed overtones 3rd & 5th)
    const h1 = Math.sin(w0)
    const h2 = Math.sin(w0 * 2) * 0.50
    const h3 = Math.sin(w0 * 3) * (0.65 * upperScale) // Prominent 3rd overtone (reed buzz)
    const h4 = Math.sin(w0 * 4) * 0.30
    const h5 = Math.sin(w0 * 5) * (0.40 * upperScale) // Prominent 5th overtone
    const h6 = Math.sin(w0 * 6) * (0.18 * upperScale)
    const h7 = Math.sin(w0 * 7) * (0.10 * upperScale)

    // Reed attack chiff transient (< 20ms)
    const chiff = (Math.random() * 2 - 1) * chiffAmp * Math.exp(-t / 0.018)

    // Tonal evolution during note onset (brightness builds up slightly over first 30ms)
    const brightnessEvo = 1 + 0.15 * Math.min(1, t / 0.030)

    // Delayed expressive amplitude vibrato (onset delayed by 250ms, volume swell, zero pitch shift)
    const vibOnset = Math.min(1, Math.max(0, (t - 0.25) * 3))
    const tremolo = 1 + 0.025 * Math.sin(2 * Math.PI * 5.0 * t) * vibOnset

    const sample = (h1 * 0.46 + h2 * 0.22 + h3 * 0.28 + h4 * 0.13 + h5 * 0.17 + h6 * 0.08 + h7 * 0.04 + chiff) *
                   brightnessEvo * tremolo * 0.58

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
