import type { InputSource } from '../audio/types'

/**
 * Normalized input event bus — the single gateway between input sources
 * (MIDI today, others later) and the audio engine. Engine-agnostic: the
 * engine subscribes, sources never touch AudioEngine directly.
 *
 *   MIDI input → MidiManager → NoteEventBus → existing engine
 */

export type NoteBusEvent =
  | { kind: 'note-on'; note: number; velocity: number; source: InputSource; at: number }
  | { kind: 'note-off'; note: number; source: InputSource; at: number }
  | { kind: 'sustain'; on: boolean; at: number }
  | { kind: 'pitch-bend'; value: number; at: number }
  | { kind: 'modulation'; value: number; at: number }
  | { kind: 'panic'; at: number }

export type NoteBusListener = (event: NoteBusEvent) => void

export class NoteEventBus {
  private listeners = new Set<NoteBusListener>()

  emit(event: NoteBusEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }

  subscribe(listener: NoteBusListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

let bus: NoteEventBus | null = null

/** Module singleton: one bus for the whole app, survives React remounts. */
export function getNoteEventBus(): NoteEventBus {
  if (!bus) bus = new NoteEventBus()
  return bus
}
