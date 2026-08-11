import type { Instrument, InstrumentInfo, SampledBuffer } from '../instruments/Instrument'
import { DecodeCache } from './decodeCache'
import { cacheKey, idbDelete, idbGet, idbPut } from './idbCache'
import type { InstrumentDef, SampleLoadState, SampleZone } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const CONCURRENCY = 3
const FETCH_RETRIES = 3
const DEFAULT_MAX_DECODED_BYTES = 128 * 1024 * 1024

interface FileState {
  status: 'pending' | 'loading' | 'ready' | 'error'
  promise: Promise<AudioBuffer> | null
}

export interface SampleInstrumentOptions {
  /** Stable instrument id (matches the manifest's def.id). */
  id: string
  /** URL of the instrument manifest (manifest.json next to the samples). */
  defUrl: string
  /** Base URL the manifest's relative sample paths resolve against. */
  samplesBaseUrl: string
  maxDecodedBytes?: number
  /** Called whenever the load state/progress changes. */
  onLoadState?: (state: SampleLoadState) => void
}

/**
 * Manifest-driven sampled instrument. The engine treats it like any other
 * Instrument — nothing in the voice path knows about manifests, zones or
 * caches. Loading is lazy and progressive: the first note waits only for its
 * own file, the rest streams in the background with progress events.
 */
export class SampleInstrument implements Instrument {
  readonly info: InstrumentInfo

  private def: InstrumentDef | null = null
  private defPromise: Promise<InstrumentDef> | null = null
  private ctx: AudioContext | null = null
  private decodeCache: DecodeCache
  private files = new Map<string, FileState>()
  private loadPromise: Promise<void> | null = null
  private state: SampleLoadState = {
    status: 'idle',
    progress: { loadedFiles: 0, totalFiles: 0, loadedBytes: 0, totalBytes: 0, failedFiles: [] },
  }
  private cacheHits = 0
  private cacheMisses = 0
  private manifestFetches = 0
  private disposed = false

  constructor(private readonly opts: SampleInstrumentOptions) {
    this.info = { id: opts.id, name: opts.id, kind: 'samples' }
    this.decodeCache = new DecodeCache(opts.maxDecodedBytes ?? DEFAULT_MAX_DECODED_BYTES)
  }

  getState(): SampleLoadState {
    return this.state
  }

  get cacheStats(): { hits: number; misses: number; decodedEntries: number; decodedBytes: number } {
    const s = this.decodeCache.stats
    return { hits: this.cacheHits, misses: this.cacheMisses, decodedEntries: s.entries, decodedBytes: s.bytes }
  }

  /** Kick off the (re)load pipeline. Never blocks on the voice path. */
  async init(ctx: AudioContext): Promise<void> {
    if (this.disposed) return
    this.ctx = ctx
    this.kickOff()
  }

  private kickOff(): void {
    if (this.disposed || this.loadPromise) return
    this.loadPromise = this.loadAll()
      .catch((err: unknown) => {
        this.state = {
          status: 'error',
          progress: this.state.progress,
          error: err instanceof Error ? err.message : String(err),
        }
        this.emitState()
      })
      .finally(() => {
        this.loadPromise = null
      })
  }

  async getBuffer(ctx: AudioContext, midiNote: number, velocity: number): Promise<SampledBuffer> {
    const def = await this.ensureDef()
    const zone = resolveZone(def, midiNote, velocity)
    if (!zone) {
      throw new Error(`No sample zone for note ${midiNote} velocity ${velocity.toFixed(2)} in "${def.id}"`)
    }
    const buffer = await this.getDecoded(ctx, def, zone.sample)
    const cents = (midiNote - zone.rootNote) * 100 + (zone.tune ?? 0)
    const playbackRate = clamp(Math.pow(2, cents / 1200), 0.5, 2)
    return {
      buffer,
      playbackRate,
      startOffset: (zone.offset ?? 0) / def.sourceRateHz,
      gainDb: zone.gainDb,
    }
  }

  /**
   * Which zone a note+velocity resolves to. Diagnostic/testing hook; the
   * voice path uses the identical resolveZone function through getBuffer.
   */
  async resolveZone(note: number, velocity: number): Promise<SampleZone | undefined> {
    const def = await this.ensureDef()
    return resolveZone(def, note, velocity)
  }

  dispose(): void {
    this.disposed = true
    this.decodeCache.clear()
    this.files.clear()
    this.loadPromise = null
  }

  /** Reset failed files and start over (used by the engine's reload). */
  retry(ctx?: AudioContext): void {
    if (this.disposed) return
    if (ctx) this.ctx = ctx
    if (this.def) {
      this.state = {
        status: 'loading',
        progress: {
          loadedFiles: 0,
          totalFiles: this.def.files.length,
          loadedBytes: 0,
          totalBytes: this.def.files.reduce((s, f) => s + f.sizeBytes, 0),
          failedFiles: [],
        },
        error: undefined,
      }
      for (const f of this.files.values()) f.status = 'pending'
      this.emitState()
    }
    this.kickOff()
  }

  private ensureDef(): Promise<InstrumentDef> {
    if (this.def) return Promise.resolve(this.def)
    if (!this.defPromise) {
      this.defPromise = this.fetchManifest()
        .then((def) => {
          this.def = def
          this.info.id = def.id
          this.info.name = def.name
          return def
        })
        .finally(() => {
          this.defPromise = null
        })
    }
    return this.defPromise
  }

  private async fetchManifest(): Promise<InstrumentDef> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(this.opts.defUrl, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${this.opts.defUrl}`)
        const def = (await res.json()) as InstrumentDef
        validateDef(def)
        this.manifestFetches++
        return def
      } catch (err) {
        lastErr = err
        if (attempt < FETCH_RETRIES) await sleep(300 * attempt)
      }
    }
    throw new Error(`Could not load instrument manifest: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`)
  }

  private async loadAll(): Promise<void> {
    const ctx = this.ctx
    if (!ctx) throw new Error('SampleInstrument.loadAll() before init(ctx)')
    const def = await this.ensureDef()
    if (this.state.status !== 'loading') {
      this.state = {
        status: 'loading',
        progress: {
          loadedFiles: 0,
          totalFiles: def.files.length,
          loadedBytes: 0,
          totalBytes: def.files.reduce((s, f) => s + f.sizeBytes, 0),
          failedFiles: [],
        },
        error: undefined,
      }
      this.emitState()
    }

    const queue = [...def.files]
    let inFlight = 0
    await new Promise<void>((resolve) => {
      const pump = () => {
        while (inFlight < CONCURRENCY && queue.length > 0) {
          const file = queue.shift()
          if (!file) break
          inFlight++
          this.getDecoded(ctx, def, file.id)
            .catch(() => {
              /* per-file failure is recorded inside */
            })
            .finally(() => {
              inFlight--
              pump()
            })
        }
        if (queue.length === 0 && inFlight === 0) resolve()
      }
      pump()
    })

    const failed = this.state.progress.failedFiles
    if (failed.length > 0) {
      this.state = {
        status: 'error',
        progress: this.state.progress,
        error: `Failed to load ${failed.length} sample file(s): ${failed.join(', ')}`,
      }
    } else {
      this.state = { ...this.state, status: 'ready', error: undefined }
    }
    this.emitState()
  }

  /**
   * Decoded buffer for one file. Order: decoded LRU -> IndexedDB -> network.
   * A decode failure invalidates the IndexedDB entry (corruption recovery)
   * and re-fetches; repeated failure marks the file (and instrument) failed.
   */
  private async getDecoded(ctx: AudioContext, def: InstrumentDef, fileId: string): Promise<AudioBuffer> {
    const key = cacheKey(def, fileId)
    const hit = this.decodeCache.get(key)
    if (hit) {
      this.cacheHits++
      return hit
    }

    const st = this.files.get(fileId) ?? { status: 'pending' as const, promise: null }
    if (!this.files.has(fileId)) this.files.set(fileId, st)

    if (st.status === 'error') {
      this.cacheMisses++
      throw new Error(`Sample "${fileId}" previously failed to load`)
    }
    if (st.promise) {
      this.cacheMisses++
      return st.promise
    }

    st.status = 'loading'
    st.promise = this.loadOne(ctx, def, fileId)
      .then((buffer) => {
        st.status = 'ready'
        st.promise = null
        this.decodeCache.set(key, buffer)
        this.touchProgress(def, fileId)
        return buffer
      })
      .catch((err: unknown) => {
        st.status = 'error'
        st.promise = null
        this.markFailed(fileId, err)
        throw err
      })
    this.cacheMisses++
    return st.promise
  }

  private async loadOne(ctx: AudioContext, def: InstrumentDef, fileId: string): Promise<AudioBuffer> {
    const file = def.files.find((f) => f.id === fileId)
    if (!file) throw new Error(`Unknown sample file "${fileId}"`)
    const key = cacheKey(def, fileId)

    const fromIdb = await idbGet(key).catch(() => undefined)
    if (fromIdb) {
      try {
        return await decodeWithFallback(ctx, fromIdb)
      } catch {
        // Corrupted or unreadable cache entry: drop it and re-fetch.
        await idbDelete(key).catch(() => {})
      }
    }

    const raw = await this.fetchRaw(file)
    await idbPut(key, raw).catch(() => {})
    try {
      return await decodeWithFallback(ctx, raw)
    } catch (err) {
      await idbDelete(key).catch(() => {})
      throw err
    }
  }

  private async fetchRaw(file: { id: string; path: string; sizeBytes: number }): Promise<ArrayBuffer> {
    const baseUrl = new URL(this.opts.samplesBaseUrl, window.location.href).toString()
    // Percent-encode: sharp keys (e.g. D#1v1.flac) must not parse as a fragment.
    const url = new URL(encodeURI(file.path), baseUrl).toString()
    let lastErr: unknown
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
        const buf = await res.arrayBuffer()
        if (file.sizeBytes > 0 && buf.byteLength !== file.sizeBytes) {
          throw new Error(`Size mismatch for ${file.id}: expected ${file.sizeBytes}, got ${buf.byteLength}`)
        }
        return buf
      } catch (err) {
        lastErr = err
        if (attempt < FETCH_RETRIES) await sleep(400 * attempt)
      }
    }
    throw new Error(lastErr instanceof Error ? lastErr.message : String(lastErr))
  }

  /** Drop all cached audio (memory + IndexedDB + per-file state). */
  async resetCache(): Promise<void> {
    const def = await this.ensureDef().catch(() => null)
    this.decodeCache.clear()
    this.files.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
    if (def) {
      await Promise.all(def.files.map((f) => idbDelete(cacheKey(def, f.id)).catch(() => {})))
    }
  }

  private touchProgress(def: InstrumentDef, fileId: string): void {
    const p = this.state.progress
    if (p.loadedFiles >= p.totalFiles) return
    p.loadedFiles++
    const file = def.files.find((f) => f.id === fileId)
    if (file) p.loadedBytes += file.sizeBytes
    this.emitState()
  }

  private markFailed(fileId: string, err: unknown): void {
    const p = this.state.progress
    if (!p.failedFiles.includes(fileId)) p.failedFiles.push(fileId)
    const msg = err instanceof Error ? err.message : String(err)
    this.state = { ...this.state, error: `Sample "${fileId}" failed: ${msg}` }
    this.emitState()
  }

  private emitState(): void {
    if (!this.disposed) this.opts.onLoadState?.(this.state)
  }
}

function resolveZone(def: InstrumentDef, note: number, vel: number): SampleZone | undefined {
  const midiVel = Math.round(1 + clamp(vel, 0, 1) * 126)
  return def.zones.find(
    (z) => note >= z.loNote && note <= z.hiNote && midiVel >= z.velLo && midiVel <= z.velHi,
  )
}

async function decodeWithFallback(ctx: AudioContext, raw: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await ctx.decodeAudioData(raw.slice(0))
  } catch {
    // Some engines choke on a zero-copy buffer; retry on a fresh copy once.
    return ctx.decodeAudioData(raw.slice(0))
  }
}

function validateDef(def: InstrumentDef): void {
  if (!def || def.kind !== 'samples' || !Array.isArray(def.files) || !Array.isArray(def.zones)) {
    throw new Error('Invalid instrument manifest')
  }
  if (!def.license || !def.license.spdx || !def.license.attribution) {
    throw new Error('Instrument manifest is missing license/attribution info')
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
