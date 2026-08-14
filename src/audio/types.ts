import type { AudioEngineError } from './errors'
import type { SampleLoadState } from './samples/types'

export type InputSource = 'mouse' | 'touch' | 'keyboard' | 'midi' | 'programmatic'

export interface NoteOnRequest {
  /** MIDI note number (0-127), pre-transpose. Engine applies transpose + octave shift. */
  note: number
  /** 0..1 */
  velocity: number
  source: InputSource
}

export type EngineEvent =
  | { type: 'state'; state: AudioContextState }
  | { type: 'tuning' }
  | { type: 'active-notes'; notes: ReadonlySet<number> }
  | { type: 'input-notes'; notes: ReadonlySet<number> }
  | { type: 'error'; error: AudioEngineError }
  | { type: 'load'; instrumentId: string; state: SampleLoadState }

export type EngineListener = (event: EngineEvent) => void

export type LimiterKind = 'worklet' | 'dynamics-compressor' | 'none'

/** Reverb impulse-response presets, pre-generated once and cached. */
export type ReverbPresetId = 'room' | 'hall' | 'stage' | 'cathedral'

/** Requested Main Tone effect targets (engine-tracked, deterministic). */
export interface MainToneSnapshot {
  /** 0..1 */
  volume: number
  /** -1..1 (L100 .. R100) */
  pan: number
  /** 0..1 normalized cutoff; log-mapped to 100 Hz..20 kHz. */
  cutoffNorm: number
  /** Actual cutoff frequency in Hz derived from cutoffNorm. */
  cutoffHz: number
  /** 0..1 wet/send level. */
  reverbAmount: number
  reverbPreset: ReverbPresetId
  /** 0..1 wet level. */
  chorusAmount: number
  /** 0..1 delay send level. */
  delayAmount: number
  /** 0..1 seconds (0-1000 ms). */
  delayTime: number
  /** 0..0.85, hard-bounded. */
  delayFeedback: number
}

export interface NoteTimingSnapshot {
  /** Buffer acquisition time (sample load / decode) for the last note. */
  lastBufferReadyMs: number
  /** Rolling average buffer acquisition time. */
  avgBufferReadyMs: number
  /** Worst buffer acquisition time. */
  maxBufferReadyMs: number
  /** Total time from noteOn to audio-clock scheduling for the last note. */
  lastStartMs: number
  /** Fixed lead (ms) between scheduling time and audio clock time. */
  schedulingLeadMs: number
}

export interface MidiTimingSnapshot {
  /** MIDI-sourced notes scheduled so far. */
  count: number
  /** Last MIDI note: receipt-to-audio-clock-scheduling time (JS path). */
  lastSchedulingMs: number
  /** Rolling average receipt-to-scheduling time over MIDI notes. */
  avgSchedulingMs: number
  /** Worst receipt-to-scheduling time over MIDI notes. */
  maxSchedulingMs: number
  /** Fixed lead from scheduling to the audio-clock start of the voice. */
  audioClockLeadMs: number
}

export interface DiagnosticsSnapshot {
  contextState: AudioContextState | 'closed'
  sampleRate: number
  baseLatencyMs: number
  activeVoices: number
  sustainedVoices: number
  /** Highest simultaneous voice count ever observed. */
  peakActiveVoices: number
  totalStarted: number
  totalStopped: number
  steals: number
  dropped: number
  retriggers: number
  pendingLoads: number
  poolSize: number
  polyphonyCap: number
  limiter: LimiterKind
  instrument: string
  instrumentId: string
  transpose: number
  octaveShift: number
  tuningCents: number
  sustain: boolean
  /** Pitch bend value, normalized -1..1 (0 = center). */
  pitchBend: number
  /** Current pitch bend in cents (range * value * 100). */
  pitchBendCents: number
  /** Configurable pitch-bend range in semitones (2 or 12). */
  pitchBendRange: number
  /** Modulation wheel value, normalized 0..1 (reserved for future effects). */
  modulation: number
  /** Only present when the current instrument is a sampled instrument. */
  instrumentLoad?: SampleLoadState
  sampleCache?: { hits: number; misses: number; decodedEntries: number; decodedBytes: number }
  noteTiming?: NoteTimingSnapshot
  midiTiming?: MidiTimingSnapshot
  /** Main Tone effect targets (present after the audio context is created). */
  mainTone?: MainToneSnapshot
  /** Wall time to build the shared effects chain + IRs, in ms. */
  mainToneInitMs?: number
  /** Dual Tone effect targets (present after the audio context is created). */
  dualTone?: MainToneSnapshot
  dualToneInitMs?: number
  dualEnabled?: boolean
  dualInstrument?: string
  dualTranspose?: number
  dualOctaveShift?: number
  dualTuningCents?: number
  masterEQ?: MasterEQState
  splitZone?: SplitZoneSnapshot
  portamento?: PortamentoSnapshot
  arpeggiator?: ArpeggiatorSnapshot
}

export interface PortamentoSnapshot {
  enabled: boolean
  timeMs: number
}

export interface ArpeggiatorSnapshot {
  enabled: boolean
  rate: string
  direction: string
  octaveRange: number
  gate: number
  heldCount: number
  generatedCount: number
}

export interface MasterEQState {
  /** Master volume 0..1 (default 1.0) */
  volume: number
  /** Low shelf gain in dB (-12..+12 dB, default 0) */
  lowGainDb: number
  /** Peaking mid gain in dB (-12..+12 dB, default 0) */
  midGainDb: number
  /** High shelf gain in dB (-12..+12 dB, default 0) */
  highGainDb: number
}

export interface SplitZoneSnapshot {
  enabled: boolean
  splitPoint: number
  instrument: string
  octaveShift: number
  transpose: number
  tuningCents: number
  volume: number
  pan: number
  tone: MainToneSnapshot
}

export interface WorkstationPreset {
  id: string
  name: string
  category: 'factory' | 'user'
  main: {
    instrument: string
    octaveShift: number
    transpose: number
    tuningCents: number
    tone: MainToneSnapshot
  }
  dual: {
    enabled: boolean
    instrument: string
    octaveShift: number
    transpose: number
    tuningCents: number
    tone: MainToneSnapshot
  }
  split: {
    enabled: boolean
    splitPoint: number
    instrument: string
    octaveShift: number
    transpose: number
    tuningCents: number
    volume: number
    pan: number
    tone: MainToneSnapshot
  }
  master: MasterEQState
}

/** Which sample zone a note+velocity resolves to (diagnostic/testing hook). */
export interface SampleZoneInfo {
  note: number
  velocity: number
  zone: string
  sample: string
  rootNote: number
  minNote: number
  maxNote: number
  minVelocity: number
  maxVelocity: number
  gainDb?: number
  tune?: number
}
