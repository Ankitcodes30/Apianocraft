import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * FM Dyno Electric Piano: 80s FM metallic tine bell tone with dynamic index modulation
 * and glassy electric piano sustain.
 */
export class FmEPianoInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'fm-epiano',
    name: 'FM Dyno EP',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generateFmEPianoBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generateFmEPianoBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)
  const tau = clamp(2.5 * Math.pow(220 / f0, 0.35), 0.7, 3.5)
  const dur = clamp(tau * 1.8, 1.0, 3.5)
  const n = Math.floor(sampleRate * dur)

  const data = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t / tau)

    // FM Operator 2 (Modulator, 14x frequency for metallic bell tine)
    const fMod = f0 * 14.0
    const modEnv = Math.exp(-t / (tau * 0.15)) * 3.5 // Fast bell decay
    const modVal = Math.sin(2 * Math.PI * fMod * t) * modEnv

    // FM Operator 1 (Carrier)
    const carrier = Math.sin(2 * Math.PI * f0 * t + modVal)

    const fade = i > n - 400 ? (n - i) / 400 : 1
    data[i] = carrier * env * fade * 0.7
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
