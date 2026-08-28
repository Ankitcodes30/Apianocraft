import type { NoteEventBus } from '../midi/NoteEventBus'

/**
 * QWERTY computer-keyboard input adapter (Phase 7.5 / Phase 14 38-Key Redesign).
 *
 * Provides a continuous 38-key chromatic piano keyboard mapping directly playable
 * from the laptop keyboard without requiring Shift, CapsLock, or octave buttons.
 *
 * Chromatic Range: MIDI 48 (C3, Lower -1) to MIDI 85 (C#6, Upper +1)
 * Sargam Convention: C# = Sa (D#=Re, F=Ga, F#=Ma, G#=Pa, A#=Dha, C=Ni)
 */
export interface QwertyKeyMapping {
  key: string
  midiNote: number
  noteName: string
  octave: number
  rangeLabel: 'Lower (-1)' | 'Middle (0)' | 'Upper (+1)'
  sargam: string
  isBlackKey: boolean
  displayLabel: string
  order: number
}

export interface QwertyManagerOptions {
  keymap38?: Readonly<Record<string, QwertyKeyMapping>>
  baseNote?: number
  octaveMin?: number
  octaveMax?: number
}

export type QwertyManagerEvent = { type: 'octave'; octave: number } | { type: 'held-keys'; keys: string[] }
export type QwertyListener = (event: QwertyManagerEvent) => void

const SARGAM_NAMES: Record<string, string> = {
  C: 'Ni',
  'C#': 'Sa',
  D: 're',
  'D#': 'Re',
  E: 'ga',
  F: 'Ga',
  'F#': 'Ma',
  G: 'ma',
  'G#': 'Pa',
  A: 'dha',
  'A#': 'Dha',
  B: 'ni',
}

const NOTE_NAMES_12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Authoritative 38 physical playable computer keys in pitch order (MIDI 48..85).
 * Left-to-right pitch order is strictly monotonically increasing.
 */
export const PHYSICAL_38_KEYS: readonly string[] = [
  // Lower Range (-1): C3..B3 (MIDI 48..59)
  'z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm',
  // Middle Range (0): C4..B4 (MIDI 60..71)
  'q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u',
  // Upper Range (+1): C5..C#6 (MIDI 72..85)
  'i', '9', 'o', '0', 'p', '[', '=', ']', 'k', 'l', ';', "'", ',', '.',
]

function build38KeyMappings(): QwertyKeyMapping[] {
  const mappings: QwertyKeyMapping[] = []
  const startMidi = 48 // C3 (Lower -1)

  for (let i = 0; i < PHYSICAL_38_KEYS.length; i++) {
    const key = PHYSICAL_38_KEYS[i]
    const midiNote = startMidi + i
    const noteName = NOTE_NAMES_12[midiNote % 12]
    const octave = Math.floor(midiNote / 12) - 1

    let rangeLabel: 'Lower (-1)' | 'Middle (0)' | 'Upper (+1)' = 'Lower (-1)'
    if (midiNote >= 60 && midiNote <= 71) {
      rangeLabel = 'Middle (0)'
    } else if (midiNote >= 72) {
      rangeLabel = 'Upper (+1)'
    }

    const sargam = SARGAM_NAMES[noteName] ?? ''
    const isBlackKey = noteName.includes('#')

    mappings.push({
      key,
      midiNote,
      noteName,
      octave,
      rangeLabel,
      sargam,
      isBlackKey,
      displayLabel: key.toUpperCase(),
      order: i + 1,
    })
  }

  return mappings
}

export const PRIMARY_38_KEYMAP: ReadonlyArray<QwertyKeyMapping> = Object.freeze(build38KeyMappings())

export const PRIMARY_38_KEYMAP_BY_KEY: Readonly<Record<string, QwertyKeyMapping>> = Object.freeze(
  PRIMARY_38_KEYMAP.reduce<Record<string, QwertyKeyMapping>>((acc, item) => {
    acc[item.key] = item
    return acc
  }, {}),
)

// Legacy backward-compatibility index map (key -> semitone relative to C4=60)
export const DEFAULT_KEYMAP: Readonly<Record<string, number>> = Object.freeze(
  PRIMARY_38_KEYMAP.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = item.midiNote - 60
    return acc
  }, {}),
)

export const DEFAULT_BASE_NOTE = 60
export const DEFAULT_OCTAVE_MIN = -4
export const DEFAULT_OCTAVE_MAX = 4
export const DEFAULT_KEYBOARD_VELOCITY = 0.7

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable]'

export class QwertyManager {
  private readonly keymap38: Readonly<Record<string, QwertyKeyMapping>>
  private readonly octaveMin: number
  private readonly octaveMax: number
  private readonly listeners = new Set<QwertyListener>()

  private octave = 0
  private velocity = DEFAULT_KEYBOARD_VELOCITY
  /** Key (lowercased) → the MIDI note currently sounding from that key. */
  private held = new Map<string, number>()
  private started = false
  private disposed = false

  constructor(
    private readonly bus: NoteEventBus,
    options: QwertyManagerOptions = {},
  ) {
    this.keymap38 = options.keymap38 ?? PRIMARY_38_KEYMAP_BY_KEY
    this.octaveMin = options.octaveMin ?? DEFAULT_OCTAVE_MIN
    this.octaveMax = options.octaveMax ?? DEFAULT_OCTAVE_MAX
  }

  getState(): { started: boolean; octave: number; velocity: number; heldKeys: string[] } {
    return {
      started: this.started,
      octave: this.octave,
      velocity: this.velocity,
      heldKeys: [...this.held.keys()],
    }
  }

  get octaveValue(): number {
    return this.octave
  }

  get velocityValue(): number {
    return this.velocity
  }

  setVelocity(value: number): void {
    this.velocity = Math.max(0.01, Math.min(1, value))
  }

  setOctave(octave: number): void {
    const clamped = Math.max(this.octaveMin, Math.min(this.octaveMax, Math.round(octave)))
    if (clamped === this.octave) return
    this.octave = clamped
    this.emit({ type: 'octave', octave: this.octave })
  }

  subscribe(listener: QwertyListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onWindowBlur)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onWindowBlur)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.releaseAll()
  }

  releaseAll(): void {
    if (this.held.size === 0) return
    const at = performance.now()
    for (const note of this.held.values()) {
      this.bus.emit({ kind: 'note-off', note, source: 'keyboard', at })
    }
    this.held.clear()
    this.emit({ type: 'held-keys', keys: [] })
  }

  dispose(): void {
    if (!this.disposed) {
      this.stop()
      this.disposed = true
      this.listeners.clear()
    }
  }

  get38KeyMappings(): ReadonlyArray<QwertyKeyMapping> {
    return PRIMARY_38_KEYMAP
  }

  get38KeyMap(): Readonly<Record<string, QwertyKeyMapping>> {
    return this.keymap38
  }

  getMappingForKey(key: string): QwertyKeyMapping | undefined {
    return this.keymap38[key.toLowerCase()]
  }

  getKeyMap(): Readonly<Record<string, number>> {
    return DEFAULT_KEYMAP
  }

  getActiveKeys(): string[] {
    return [...this.held.keys()]
  }

  reset(): void {
    this.releaseAll()
    this.octave = 0
    this.emit({ type: 'octave', octave: 0 })
  }

  // ---- internals -----------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.started || this.disposed) return
    // Browser shortcuts (Ctrl/Cmd/Alt combos) must never play notes.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Never play while the user is typing into an editable control.
    if (this.isEditableTarget(e.target) || this.isEditableTarget(document.activeElement)) return

    const key = e.key.toLowerCase()

    const mapping = this.keymap38[key]
    if (!mapping) return

    // Hold protection: OS key-repeat and duplicate keydowns never re-trigger.
    if (e.repeat || this.held.has(key)) return
    e.preventDefault()

    // Ensure non-text controls leave zero residual highlight during QWERTY piano play
    if (document.activeElement && document.activeElement instanceof HTMLElement && !this.isEditableTarget(document.activeElement)) {
      document.activeElement.blur()
    }

    const note = Math.max(0, Math.min(127, mapping.midiNote + this.octave * 12))
    this.held.set(key, note)
    this.bus.emit({ kind: 'note-on', note, velocity: this.velocity, source: 'keyboard', at: e.timeStamp })
    this.emit({ type: 'held-keys', keys: [...this.held.keys()] })
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (!this.started || this.disposed) return
    const key = e.key.toLowerCase()
    const note = this.held.get(key)
    if (note === undefined) return
    this.held.delete(key)
    this.bus.emit({ kind: 'note-off', note, source: 'keyboard', at: e.timeStamp })
    this.emit({ type: 'held-keys', keys: [...this.held.keys()] })
  }

  private readonly onWindowBlur = (): void => {
    this.releaseAll()
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.releaseAll()
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    const el = target.closest<HTMLElement>(EDITABLE_SELECTOR)
    if (!el) return false

    if (el.tagName.toLowerCase() === 'textarea') return true
    if (el.isContentEditable) return true

    if (el.tagName.toLowerCase() === 'input') {
      const input = el as HTMLInputElement
      const type = (input.type || 'text').toLowerCase()
      const nonTextTypes = ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']
      return !nonTextTypes.includes(type)
    }

    return false
  }

  private emit(event: QwertyManagerEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }
}

let manager: QwertyManager | null = null

export function getQwertyManager(bus: NoteEventBus): QwertyManager {
  if (!manager) manager = new QwertyManager(bus)
  return manager
}
