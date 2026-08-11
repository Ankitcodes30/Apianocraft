/**
 * Instrument manifest types. A manifest describes one sampled instrument:
 * license provenance, files and the zone map (note range, root note,
 * velocity range, playback parameters) — everything the sampler needs.
 */

export interface SampleLicenseInfo {
  /** SPDX identifier, e.g. 'CC-BY-3.0'. */
  spdx: string
  title: string
  author: string
  source: string
  /** Required attribution line, shown verbatim in the app. */
  attribution: string
  /** Statement that redistribution/public deployment is permitted. */
  redistribution: string
  notice?: string
}

export interface SampleFile {
  id: string
  /** Path relative to the served samples base. */
  path: string
  sizeBytes: number
  sourceUrl?: string
}

/** One playback zone: a sample pitched across a note+velocity range. */
export interface SampleZone {
  /** SampleFile.id */
  sample: string
  loNote: number
  hiNote: number
  rootNote: number
  velLo: number
  velHi: number
  /** Samples to skip at the start of the file (attack trim), source-rate. */
  offset?: number
  /** Fine tuning in cents (SFZ `tune`). */
  tune?: number
  /** Per-zone gain (dB). Absent = 0 dB. */
  gainDb?: number
}

export interface InstrumentDef {
  id: string
  name: string
  version: string
  kind: 'samples'
  /** Sample rate of the source files (offsets are counted in these frames). */
  sourceRateHz: number
  description?: string
  license: SampleLicenseInfo
  files: SampleFile[]
  zones: SampleZone[]
}

export type SampleLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SampleLoadProgress {
  loadedFiles: number
  totalFiles: number
  loadedBytes: number
  totalBytes: number
  failedFiles: string[]
}

export interface SampleLoadState {
  status: SampleLoadStatus
  progress: SampleLoadProgress
  error?: string
}

/** What the sampler resolved for a note: which file, at what pitch/offset. */
export interface ResolvedSample {
  zone: SampleZone
  file: SampleFile
  playbackRate: number
  startOffsetSeconds: number
}
