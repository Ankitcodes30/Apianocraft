import type { AudioEngine } from '../audio/AudioEngine'

/**
 * Performance control layer — the single gateway between high-frequency
 * performance controllers (PerformancePad today, MIDI pitch/mod wheels later)
 * and the engine's existing pitch-bend + modulation controls.
 *
 * All methods are pre-bound at construction: calling them on the pointer-move
 * hot path allocates nothing. They converge on the same engine controls the
 * MIDI path uses (engine.setPitchBend / setModulation), so every source
 * shares one implementation and one diagnostics state.
 */
export class PerformanceControls {
  readonly pitchBend: (value: number) => void
  readonly modulation: (value: number) => void
  readonly setPitchBendRange: (semitones: number) => void

  constructor(engine: AudioEngine) {
    this.pitchBend = engine.setPitchBend.bind(engine)
    this.modulation = engine.setModulation.bind(engine)
    this.setPitchBendRange = engine.setPitchBendRange.bind(engine)
  }
}
