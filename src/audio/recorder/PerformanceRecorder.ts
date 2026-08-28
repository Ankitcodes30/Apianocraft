import type { InputSource } from '../types'

export type RecordedEventType = 'noteOn' | 'noteOff' | 'sustain' | 'pitchBend' | 'modulation'

export interface RecordedEvent {
  timeMs: number
  type: RecordedEventType
  note?: number
  velocity?: number
  source?: InputSource
  sustain?: boolean
  value?: number
}

export type TransportState = 'idle' | 'recording' | 'playing' | 'paused'

export interface TransportSnapshot {
  state: TransportState
  recordedTimeMs: number
  eventCount: number
}

export class PerformanceRecorder {
  private state: TransportState = 'idle'
  private startTime: number = 0
  private totalPausedMs: number = 0
  private events: RecordedEvent[] = []
  private playbackTimerId: number | null = null
  private listeners = new Set<(snapshot: TransportSnapshot) => void>()

  getState(): TransportState {
    return this.state
  }

  getSnapshot(): TransportSnapshot {
    let recordedTimeMs = 0
    if (this.state === 'recording' || this.state === 'playing') {
      recordedTimeMs = Math.max(0, performance.now() - this.startTime - this.totalPausedMs)
    } else if (this.events.length > 0) {
      recordedTimeMs = this.events[this.events.length - 1].timeMs
    }

    return {
      state: this.state,
      recordedTimeMs,
      eventCount: this.events.length,
    }
  }

  subscribe(listener: (snapshot: TransportSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const snap = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snap)
    }
  }

  startRecording(): void {
    this.stopPlayback()
    this.events = []
    this.startTime = performance.now()
    this.totalPausedMs = 0
    this.state = 'recording'
    this.notify()
  }

  stopRecording(): RecordedEvent[] {
    if (this.state === 'recording') {
      this.state = 'idle'
      this.notify()
    }
    return [...this.events]
  }

  recordEvent(event: Omit<RecordedEvent, 'timeMs'>): void {
    if (this.state !== 'recording') return
    const timeMs = Math.max(0, performance.now() - this.startTime - this.totalPausedMs)
    this.events.push({ ...event, timeMs })
    this.notify()
  }

  getEvents(): RecordedEvent[] {
    return [...this.events]
  }

  clear(): void {
    this.stopPlayback()
    this.events = []
    this.state = 'idle'
    this.notify()
  }

  startPlayback(
    dispatcher: {
      noteOn: (note: number, vel: number, source: InputSource) => void
      noteOff: (note: number) => void
      setSustainPedal: (down: boolean) => void
      setPitchBend: (val: number) => void
      setModulation: (val: number) => void
    },
    onComplete?: () => void,
  ): void {
    if (this.events.length === 0) return
    this.stopPlayback()

    this.state = 'playing'
    this.startTime = performance.now()
    this.totalPausedMs = 0
    this.notify()

    let eventIdx = 0
    const totalEvents = this.events.length

    const step = () => {
      if (this.state !== 'playing') return

      const nowMs = performance.now() - this.startTime - this.totalPausedMs
      while (eventIdx < totalEvents && this.events[eventIdx].timeMs <= nowMs) {
        const ev = this.events[eventIdx]
        switch (ev.type) {
          case 'noteOn':
            if (ev.note !== undefined && ev.velocity !== undefined) {
              dispatcher.noteOn(ev.note, ev.velocity, ev.source ?? 'programmatic')
            }
            break
          case 'noteOff':
            if (ev.note !== undefined) {
              dispatcher.noteOff(ev.note)
            }
            break
          case 'sustain':
            if (ev.sustain !== undefined) {
              dispatcher.setSustainPedal(ev.sustain)
            }
            break
          case 'pitchBend':
            if (ev.value !== undefined) {
              dispatcher.setPitchBend(ev.value)
            }
            break
          case 'modulation':
            if (ev.value !== undefined) {
              dispatcher.setModulation(ev.value)
            }
            break
        }
        eventIdx++
      }

      if (eventIdx >= totalEvents) {
        this.state = 'idle'
        this.playbackTimerId = null
        this.notify()
        onComplete?.()
      } else {
        this.playbackTimerId = window.requestAnimationFrame(step)
      }
    }

    this.playbackTimerId = window.requestAnimationFrame(step)
  }

  stopPlayback(): void {
    if (this.playbackTimerId !== null) {
      window.cancelAnimationFrame(this.playbackTimerId)
      this.playbackTimerId = null
    }
    if (this.state === 'playing') {
      this.state = 'idle'
      this.notify()
    }
  }
}
