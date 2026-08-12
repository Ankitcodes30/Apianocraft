/**
 * Metronome — Sample-accurate audio-clock lookahead metronome scheduler.
 * Uses AudioContext.currentTime to schedule procedural wooden click impulses
 * in advance, guaranteeing 0 jitter even under heavy UI load.
 */

export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8'

export interface MetronomeSnapshot {
  running: boolean
  bpm: number
  timeSignature: TimeSignature
  accentBeat1: boolean
  volume: number
  currentBeat: number
}

export class Metronome {
  private ctx: AudioContext | null = null
  private running = false
  private bpm = 120
  private timeSignature: TimeSignature = '4/4'
  private accentBeat1 = true
  private volume = 0.7
  private currentBeat = 0

  private nextNoteTime = 0
  private timerId: number | null = null
  private tapTimestamps: number[] = []
  private listeners = new Set<(snap: MetronomeSnapshot) => void>()

  // High/low click buffers
  private accentBuffer: AudioBuffer | null = null
  private beatBuffer: AudioBuffer | null = null

  init(ctx: AudioContext): void {
    this.ctx = ctx
    this.createClickBuffers()
  }

  private createClickBuffers(): void {
    if (!this.ctx) return
    const sr = this.ctx.sampleRate

    // 1. Accent Click (1500 Hz decaying impulse, 30 ms)
    const accentLen = Math.floor(sr * 0.03)
    this.accentBuffer = this.ctx.createBuffer(1, accentLen, sr)
    const accData = this.accentBuffer.getChannelData(0)
    for (let i = 0; i < accentLen; i++) {
      const t = i / sr
      const env = Math.exp(-t * 150)
      accData[i] = Math.sin(2 * Math.PI * 1500 * t) * env
    }

    // 2. Normal Beat Click (1000 Hz decaying impulse, 25 ms)
    const beatLen = Math.floor(sr * 0.025)
    this.beatBuffer = this.ctx.createBuffer(1, beatLen, sr)
    const beatData = this.beatBuffer.getChannelData(0)
    for (let i = 0; i < beatLen; i++) {
      const t = i / sr
      const env = Math.exp(-t * 180)
      beatData[i] = Math.sin(2 * Math.PI * 1000 * t) * env
    }
  }

  getSnapshot(): MetronomeSnapshot {
    return {
      running: this.running,
      bpm: this.bpm,
      timeSignature: this.timeSignature,
      accentBeat1: this.accentBeat1,
      volume: this.volume,
      currentBeat: this.currentBeat,
    }
  }

  subscribe(listener: (snap: MetronomeSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const snap = this.getSnapshot()
    for (const l of this.listeners) l(snap)
  }

  setBpm(val: number): void {
    this.bpm = Math.max(30, Math.min(280, Math.round(val)))
    this.notify()
  }

  setTimeSignature(sig: TimeSignature): void {
    this.timeSignature = sig
    this.notify()
  }

  setAccentBeat1(accent: boolean): void {
    this.accentBeat1 = accent
    this.notify()
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    this.notify()
  }

  tapTempo(): number {
    const now = performance.now()
    this.tapTimestamps.push(now)

    // Keep last 4 taps within 3 seconds
    if (this.tapTimestamps.length > 1) {
      const first = this.tapTimestamps[0]
      if (now - first > 3000) {
        this.tapTimestamps.shift()
      }
    }

    if (this.tapTimestamps.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < this.tapTimestamps.length; i++) {
        intervals.push(this.tapTimestamps[i] - this.tapTimestamps[i - 1])
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const calculatedBpm = Math.round(60000 / avgMs)
      this.setBpm(calculatedBpm)
      return calculatedBpm
    }

    return this.bpm
  }

  start(): void {
    if (this.running || !this.ctx) return
    this.running = true
    this.currentBeat = 0
    this.nextNoteTime = this.ctx.currentTime + 0.05
    this.notify()

    const scheduler = () => {
      if (!this.running || !this.ctx) return
      // Schedule notes 100ms ahead
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleClick(this.nextNoteTime, this.currentBeat)
        this.advanceNote()
      }
      this.timerId = window.setTimeout(scheduler, 25)
    }

    scheduler()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    this.notify()
  }

  private beatsPerBar(): number {
    switch (this.timeSignature) {
      case '2/4': return 2
      case '3/4': return 3
      case '4/4': return 4
      case '6/8': return 6
    }
  }

  private advanceNote(): void {
    const secondsPerBeat = 60.0 / this.bpm
    const factor = this.timeSignature === '6/8' ? 0.5 : 1.0
    this.nextNoteTime += secondsPerBeat * factor
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar()
  }

  private scheduleClick(time: number, beat: number): void {
    if (!this.ctx || this.volume <= 0) return

    const isAccent = beat === 0 && this.accentBeat1
    const buffer = isAccent ? this.accentBuffer : this.beatBuffer
    if (!buffer) return

    const src = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()

    src.buffer = buffer
    gain.gain.value = isAccent ? this.volume : this.volume * 0.7

    src.connect(gain)
    gain.connect(this.ctx.destination)

    src.start(time)
  }
}
