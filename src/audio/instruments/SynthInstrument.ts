import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { midiToFreq } from './Instrument'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Deterministic PRNG so generated timbres are stable per note. */
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
 * Demo instrument: procedurally synthesized piano-like timbre, one buffer per
 * note, generated lazily and cached. Uses the exact same sampler path as real
 * multisamples (AudioBufferSourceNode + playbackRate-ready) so the engine is
 * validated before Phase 3 samples replace this provider.
 */
export class SynthInstrument implements Instrument {
  readonly info: InstrumentInfo = {
    id: 'demo-piano',
    name: 'Demo Piano',
    kind: 'synth',
  }

  private cache = new Map<string, AudioBuffer>()

  async getBuffer(ctx: AudioContext, midiNote: number): Promise<SampledBuffer> {
    const key = String(midiNote)
    const hit = this.cache.get(key)
    if (hit) return { buffer: hit, playbackRate: 1, startOffset: 0 }

    const buffer = generatePianoishBuffer(ctx, midiNote)
    this.cache.set(key, buffer)
    return { buffer, playbackRate: 1, startOffset: 0 }
  }

  dispose(): void {
    this.cache.clear()
  }
}

function generatePianoishBuffer(ctx: AudioContext, midiNote: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const f0 = midiToFreq(midiNote)

  // Register-dependent decay: low notes ring longer.
  const tau = clamp(1.2 * Math.pow(220 / f0, 0.5), 0.3, 1.4)
  const dur = clamp(tau * 3.0, 0.6, 2.0)
  const n = Math.floor(sampleRate * dur)

  const rng = mulberry32(midiNote * 2654435761)
  const maxPartial = f0 < 120 ? 18 : f0 < 300 ? 14 : 10
  const inharmonicity = 0.0002 + 0.0004 * ((midiNote - 21) / 87)
  const nyquist = sampleRate / 2 - 80

  const data = new Float32Array(n)
  let ampSum = 0

  const partials: { amp: number; phase: number; w: number }[] = []
  for (let k = 1; k <= maxPartial; k++) {
    const fk = f0 * k * Math.sqrt(1 + inharmonicity * k * k)
    if (fk > nyquist) break
    const amp = Math.pow(0.85, k) * (0.55 + 0.45 * rng())
    const detune = 1 + (rng() - 0.5) * 0.0008
    partials.push({ amp, phase: rng() * Math.PI * 2, w: (2 * Math.PI * fk * detune) / sampleRate })
    ampSum += amp
  }
  const norm = ampSum > 0 ? 0.9 / ampSum : 1

  for (const p of partials) {
    let ph = p.phase
    const a = p.amp * norm
    for (let i = 0; i < n; i++) {
      data[i] += a * Math.sin(ph)
      ph += p.w
    }
  }

  // Amplitude envelope: fast attack, exponential decay, short end fade.
  const fadeSamples = Math.min(n, Math.floor(sampleRate * 0.008))
  const attackSamples = Math.min(n, Math.floor(sampleRate * 0.003))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const attack = i < attackSamples ? i / attackSamples : 1
    const fade = i > n - fadeSamples ? (n - i) / fadeSamples : 1
    data[i] *= Math.exp(-t / tau) * attack * fade
  }

  const buffer = ctx.createBuffer(1, n, sampleRate)
  buffer.copyToChannel(data, 0)
  return buffer
}
