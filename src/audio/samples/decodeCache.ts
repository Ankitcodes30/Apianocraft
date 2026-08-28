/**
 * LRU cache of decoded AudioBuffers, bounded by an estimated byte budget
 * (length * channels * 4 bytes). Buffers are immutable once decoded, so they
 * can be shared across voices and across plays. Eviction is least-recently-
 * used on insert; decoded data is re-loadable from IndexedDB or network.
 */

export class DecodeCache {
  private map = new Map<string, AudioBuffer>()
  private bytes = 0

  constructor(private maxBytes: number) {}

  get(key: string): AudioBuffer | undefined {
    const value = this.map.get(key)
    if (!value) return undefined
    // Refresh recency without disturbing iteration order of the rest.
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, buffer: AudioBuffer): void {
    const existing = this.map.get(key)
    if (existing) this.bytes -= bufferBytes(existing)
    this.map.delete(key)
    this.map.set(key, buffer)
    this.bytes += bufferBytes(buffer)
    while (this.bytes > this.maxBytes && this.map.size > 1) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      const evicted = this.map.get(oldest)
      this.map.delete(oldest)
      // Subtract the evicted buffer's own size — grabbing it before deletion.
      if (evicted) this.bytes -= bufferBytes(evicted)
    }
  }

  /** Drop every entry whose key starts with `prefix` (one instrument). */
  unloadPrefix(prefix: string): void {
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        const b = this.map.get(key)
        if (b) this.bytes -= bufferBytes(b)
        this.map.delete(key)
      }
    }
  }

  get stats(): { entries: number; bytes: number } {
    return { entries: this.map.size, bytes: this.bytes }
  }

  clear(): void {
    this.map.clear()
    this.bytes = 0
  }
}

function bufferBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4
}
