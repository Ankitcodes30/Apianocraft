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
 * Electric Piano (EP) procedural instrument: FM tine synthesis with bell-like
 * harmonics, gentle key attack transient, and metallic decay.
 */
export class SynthEPianoInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'electric-piano',
    name: 'Electric Piano',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateEpianoBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateEpianoBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(1.8 * Math.pow(220 / f0, 0.4), 0.5, 2.2)
  const dur = clamp(tau * 2.5, 0.8, 2.5)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 1013904223)
  const data = new Float32Array(n)

  // FM modulation: carrier f0, modulator f0 * 14 (tine bell harmonic)
  const modRatio = 14
  const modIndex = 1.8 * (0.8 + 0.4 * rng())
  const modTau = tau * 0.15

  const w0 = (2 * Math.PI * f0) / sampleRate
  const wMod = (2 * Math.PI * f0 * modRatio) / sampleRate

  // Key click attack transient
  const clickDur = Math.floor(sampleRate * 0.004)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)
    const modEnv = modIndex * Math.exp(-t / modTau)
    const modSignal = modEnv * Math.sin(wMod * i)

    // Primary tine carrier + 2nd harmonic tone
    let sample = Math.sin(w0 * i + modSignal) * 0.8 + Math.sin(w0 * 2 * i) * 0.25

    if (i < clickDur) {
      const click = (rng() * 2 - 1) * (1 - i / clickDur) * 0.15
      sample += click
    }

    const attack = i < sampleRate * 0.002 ? i / (sampleRate * 0.002) : 1
    const fade = i > n - 500 ? (n - i) / 500 : 1
    data[i] = sample * env * attack * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
