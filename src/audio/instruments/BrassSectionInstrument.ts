import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Orchestral Brass Section: Full, powerful orchestral brass (Horns, Trombones, Trumpets, Tuba).
 * Features rich low-mid body foundation, sub-bass horn partials, velocity-sensitive
 * orchestral attack buildup, cinematic projection, 100% pitch stability, and smooth release.
 */
export class BrassSectionInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'brass-section',
    name: 'Brass Section',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number, velocity: number = 0.8): Promise<SampledBuffer> {
    const vel = clamp(velocity, 0.1, 1.0)
    const velBand = clamp(Math.floor(vel * 4), 0, 3)
    const key = `${midiNote}_v${velBand}`

    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateOrchestralBrassBuffer(ctx, midiNote, velBand)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateOrchestralBrassBuffer(ctx: AudioContext, midiNote: number, velBand: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.4 * Math.pow(220 / f0, 0.25), 1.0, 3.0)
  const dur = clamp(tau * 1.5, 1.2, 3.0)
  const n = Math.floor(sampleRate * dur)
  const data = new Float32Array(n)

  // Velocity-layered orchestral attack times
  const attackMs = [0.038, 0.030, 0.022, 0.016][velBand]
  const attackSamples = Math.floor(sampleRate * attackMs)
  const fadeSamples = Math.floor(sampleRate * 0.015)

  // Velocity-layered upper harmonic scale factors & sub-body weight
  const upperScale = [0.25, 0.50, 0.75, 1.00][velBand]
  const subWeight = [0.30, 0.22, 0.15, 0.08][velBand] // Horn/Tuba sub-body warmth

  // Micro-detuning for orchestral brass width
  const detuneB = 1.0005
  const detuneC = 0.9995

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const attack = i < attackSamples ? i / attackSamples : 1

    // Sub-octave French Horn / Tuba body partial (0.5x frequency)
    const wSub = 2 * Math.PI * (f0 * 0.5) * t
    const sub1 = Math.sin(wSub) * subWeight
    const sub2 = Math.sin(wSub * 2) * (subWeight * 0.6)

    // Layer 1 (French Horn / Trombone Center)
    const w1 = 2 * Math.PI * f0 * t
    const h1 = Math.sin(w1)
    const h2 = Math.sin(w1 * 2) * 0.82
    const h3 = Math.sin(w1 * 3) * 0.58
    const h4 = Math.sin(w1 * 4) * 0.38 * upperScale
    const h5 = Math.sin(w1 * 5) * 0.20 * upperScale
    const h6 = Math.sin(w1 * 6) * 0.10 * upperScale
    const l1 = h1 * 0.38 + h2 * 0.28 + h3 * 0.18 + h4 * 0.11 + h5 * 0.06 + h6 * 0.03

    // Layer 2 (Orchestral Brass Left: phase offset + micro-detune)
    const w2 = 2 * Math.PI * (f0 * detuneB) * t + 0.45
    const b1 = Math.sin(w2)
    const b2 = Math.sin(w2 * 2) * 0.75
    const b3 = Math.sin(w2 * 3) * 0.50
    const b4 = Math.sin(w2 * 4) * 0.30 * upperScale
    const l2 = b1 * 0.32 + b2 * 0.22 + b3 * 0.14 + b4 * 0.08

    // Layer 3 (Orchestral Brass Right: phase offset + micro-detune)
    const w3 = 2 * Math.PI * (f0 * detuneC) * t + 0.85
    const c1 = Math.sin(w3)
    const c2 = Math.sin(w3 * 2) * 0.72
    const c3 = Math.sin(w3 * 3) * 0.46
    const c4 = Math.sin(w3 * 4) * 0.26 * upperScale
    const l3 = c1 * 0.30 + c2 * 0.20 + c3 * 0.13 + c4 * 0.07

    // Combined orchestral brass section
    const sample = (l1 * 0.46 + l2 * 0.27 + l3 * 0.27 + sub1 * 0.15 + sub2 * 0.08) * 0.58

    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] = sample * env * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
