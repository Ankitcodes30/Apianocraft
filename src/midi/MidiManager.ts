import type { NoteEventBus } from './NoteEventBus'

/**
 * Standalone MIDI manager — no React, no AudioEngine dependency.
 * Feature-detects Web MIDI, discovers input devices, hot-plugs, selects an
 * input, and converts raw MIDI messages into normalized NoteEventBus events:
 *
 *   MIDI input → MidiManager → normalized events → NoteEventBus → engine
 *
 * If Web MIDI is unavailable or access is denied, the manager degrades to
 * 'unavailable' and the application keeps working (QWERTY / mouse / touch).
 */

export type MidiSupport = 'unknown' | 'available' | 'unavailable'

export interface MidiDeviceInfo {
  id: string
  name: string
  manufacturer: string
  connected: boolean
}

export interface MidiStats {
  messages: number
  noteOns: number
  noteOffs: number
  sustains: number
  bends: number
  modulations: number
  panics: number
}

export type MidiManagerEvent =
  | { type: 'state'; support: MidiSupport; error?: string }
  | { type: 'devices'; devices: MidiDeviceInfo[]; selected: string | null }
  | { type: 'activity'; lastEvent: string; at: number; note?: number; value?: number }

export type MidiListener = (event: MidiManagerEvent) => void

const ACCESS_TIMEOUT_MS = 5000
const ACTIVITY_THROTTLE_MS = 100

export class MidiManager {
  private support: MidiSupport = 'unknown'
  private error: string | undefined
  private access: MIDIAccess | null = null
  private devices: MidiDeviceInfo[] = []
  private selected: string | null = null
  /** Inputs that already have a midimessage listener (idempotent attach). */
  private attached = new Set<MIDIInput>()
  private listeners = new Set<MidiListener>()
  private statsData: MidiStats = { messages: 0, noteOns: 0, noteOffs: 0, sustains: 0, bends: 0, modulations: 0, panics: 0 }
  private lastActivityNote: number | undefined
  private lastActivityValue: number | undefined
  private lastActivityEmitAt = 0
  private started = false
  private disposed = false

  constructor(private readonly bus: NoteEventBus) {}

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  }

  getState(): { support: MidiSupport; error?: string; devices: MidiDeviceInfo[]; selected: string | null } {
    return { support: this.support, error: this.error, devices: [...this.devices], selected: this.selected }
  }

  getStats(): MidiStats {
    return { ...this.statsData }
  }

  get selectedId(): string | null {
    return this.selected
  }

  /** Feature-detection result without touching the device layer. */
  get supportLevel(): MidiSupport {
    return this.support
  }

  subscribe(listener: MidiListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Begin Web MIDI access. Safe to call repeatedly; idempotent. */
  async start(): Promise<void> {
    if (this.started || this.disposed) return
    this.started = true
    if (!MidiManager.isSupported()) {
      this.setSupport('unavailable', 'Web MIDI API is not available in this browser')
      return
    }
    let access: MIDIAccess
    try {
      access = await this.withTimeout(navigator.requestMIDIAccess({ sysex: false }))
    } catch (cause) {
      this.setSupport('unavailable', cause instanceof Error ? cause.message : String(cause))
      return
    }
    if (this.disposed) return
    this.access = access
    this.setSupport('available')
    access.addEventListener('statechange', (e) => this.handleStateChange(e))
    this.syncDevices(access.inputs)
  }

  /** Select which connected input's messages are routed (null = none). */
  selectInput(id: string | null): void {
    if (this.selected === id) return
    if (id !== null && !this.devices.some((d) => d.id === id && d.connected)) return
    this.selected = id
    this.emit({ type: 'devices', devices: [...this.devices], selected: this.selected })
  }

  dispose(): void {
    this.disposed = true
    this.access = null
    this.devices = []
    this.selected = null
    this.listeners.clear()
  }

  // ---- internals -----------------------------------------------------------

  private withTimeout(promise: Promise<MIDIAccess>): Promise<MIDIAccess> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('Timed out waiting for MIDI access (no permission prompt?)')),
        ACCESS_TIMEOUT_MS,
      )
      promise.then(
        (v) => {
          window.clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          window.clearTimeout(timer)
          reject(e)
        },
      )
    })
  }

  private setSupport(support: MidiSupport, error?: string): void {
    this.support = support
    this.error = error
    this.emit({ type: 'state', support, error })
  }

  private syncDevices(inputs: MIDIInputMap): void {
    const next: MidiDeviceInfo[] = []
    inputs.forEach((input) => {
      if (input.type !== 'input') return
      next.push({ id: input.id, name: input.name, manufacturer: input.manufacturer, connected: input.state === 'connected' })
      this.attachInput(input)
    })
    this.devices = next
    if (this.selected === null) {
      const first = this.devices.find((d) => d.connected)
      this.selected = first ? first.id : null
    }
    this.emit({ type: 'devices', devices: [...this.devices], selected: this.selected })
  }

  /** Attach a midimessage listener at most once per input object. */
  private attachInput(input: MIDIInput): void {
    if (this.attached.has(input)) return
    this.attached.add(input)
    input.addEventListener('midimessage', (e) => this.handleMessage(e))
  }

  private handleStateChange(e: MIDIConnectionEvent): void {
    const port = e.port
    if (!port || port.type !== 'input') return
    const index = this.devices.findIndex((d) => d.id === port.id)
    if (port.state === 'connected') {
      if (index === -1) {
        const inputs = this.access?.inputs
        const input = inputs?.get(port.id)
        if (input) this.attachInput(input)
        this.devices.push({ id: port.id, name: port.name ?? '', manufacturer: port.manufacturer ?? '', connected: true })
      } else {
        this.devices[index] = { ...this.devices[index], connected: true }
        const input = this.access?.inputs.get(port.id)
        if (input) this.attachInput(input)
      }
      if (this.selected === null) {
        const first = this.devices.find((d) => d.connected)
        if (first) this.selected = first.id
      }
    } else {
      if (index !== -1) {
        this.devices[index] = { ...this.devices[index], connected: false }
        if (this.selected === port.id) {
          const first = this.devices.find((d) => d.connected)
          this.selected = first ? first.id : null
        }
      }
    }
    this.emit({ type: 'devices', devices: [...this.devices], selected: this.selected })
  }

  private handleMessage(event: MIDIMessageEvent): void {
    if (this.disposed) return
    this.statsData.messages++
    const data = event.data
    if (!data || data.length < 1) return
    const status = data[0] & 0xf0
    const data1 = data[1] ?? 0
    const data2 = data[2] ?? 0
    const at = performance.now()

    switch (status) {
      case 0x90: // note on (velocity 0 => note off)
        if (data2 > 0) {
          this.statsData.noteOns++
          this.touch('note-on', at, data1, data2 / 127)
          this.bus.emit({ kind: 'note-on', note: data1, velocity: data2 / 127, source: 'midi', at })
        } else {
          this.statsData.noteOffs++
          this.touch('note-off', at, data1)
          this.bus.emit({ kind: 'note-off', note: data1, source: 'midi', at })
        }
        break
      case 0x80: // note off
        this.statsData.noteOffs++
        this.touch('note-off', at, data1)
        this.bus.emit({ kind: 'note-off', note: data1, source: 'midi', at })
        break
      case 0xb0: // control change
        if (data1 === 0x40) {
          // CC64 sustain: <64 off, >=64 on. Reuses the engine's sustain system.
          this.statsData.sustains++
          this.touch('sustain', at, undefined, data2)
          this.bus.emit({ kind: 'sustain', on: data2 >= 64, at })
        } else if (data1 === 0x01) {
          // CC1 modulation wheel: 0..127 -> 0..1
          this.statsData.modulations++
          this.touch('modulation', at, undefined, data2 / 127)
          this.bus.emit({ kind: 'modulation', value: data2 / 127, at })
        } else if (data1 === 0x78 || data1 === 0x79 || data1 === 0x7b) {
          // CC120/121/123: all sound off / reset controllers / all notes off
          this.statsData.panics++
          this.touch('panic', at)
          this.bus.emit({ kind: 'panic', at })
        }
        break
      case 0xe0: // pitch bend, 14-bit: 0..16383, center 8192
        {
          const raw = data1 | (data2 << 7)
          this.statsData.bends++
          this.touch('pitch-bend', at, undefined, (raw - 8192) / 8192)
          this.bus.emit({ kind: 'pitch-bend', value: (raw - 8192) / 8192, at })
        }
        break
      default:
        break
    }
  }

  /** Throttled activity signal for low-frequency UI updates only. */
  private touch(name: string, at: number, note?: number, value?: number): void {
    if (note !== undefined) this.lastActivityNote = note
    if (value !== undefined) this.lastActivityValue = value
    if (at - this.lastActivityEmitAt < ACTIVITY_THROTTLE_MS) return
    this.lastActivityEmitAt = at
    this.emit({ type: 'activity', lastEvent: name, at, note: this.lastActivityNote, value: this.lastActivityValue })
  }

  private emit(event: MidiManagerEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }
}

let manager: MidiManager | null = null

/** Module singleton: one manager per app lifetime, survives React remounts. */
export function getMidiManager(bus: NoteEventBus): MidiManager {
  if (!manager) manager = new MidiManager(bus)
  return manager
}
