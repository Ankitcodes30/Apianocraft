/**
 * Minimal ambient types for the Web MIDI API (not in the DOM lib).
 * Only the surface MidiManager actually touches.
 */

interface MIDIInput {
  readonly id: string
  readonly name: string
  readonly manufacturer: string
  readonly state: 'connected' | 'disconnected'
  readonly connection: 'open' | 'closed' | 'pending'
  readonly type: 'input' | 'output'
  readonly version: string
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
  addEventListener(type: 'midimessage', listener: (event: MIDIMessageEvent) => void): void
  removeEventListener(type: 'midimessage', listener: (event: MIDIMessageEvent) => void): void
}

interface MIDIInputMap {
  readonly size: number
  get(id: string): MIDIInput | undefined
  has(id: string): boolean
  forEach(callback: (input: MIDIInput, id: string) => void): void
}

interface MIDIMessageEvent {
  readonly data: Uint8Array
  readonly receivedTime: number
}

interface MIDIConnectionEvent {
  readonly port: Pick<MIDIInput, 'id' | 'name' | 'manufacturer' | 'state' | 'connection' | 'type'>
}

interface MIDIAccess {
  readonly inputs: MIDIInputMap
  readonly sysexEnabled: boolean
  onstatechange: ((event: MIDIConnectionEvent) => void) | null
  addEventListener(type: 'statechange', listener: (event: MIDIConnectionEvent) => void): void
  removeEventListener(type: 'statechange', listener: (event: MIDIConnectionEvent) => void): void
}

interface Navigator {
  requestMIDIAccess(options?: { sysex: boolean }): Promise<MIDIAccess>
}
