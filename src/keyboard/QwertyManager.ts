import type { NoteEventBus } from '../midi/NoteEventBus'

/**
 * QWERTY computer-keyboard input adapter (Phase 7.5).
 *
 *   Physical keyboard → QwertyManager → NoteEventBus → engine adapter → engine
 *
 * The manager never calls AudioEngine directly — like MidiManager it only
 * emits normalized NoteEventBus events (source: 'keyboard'). A physical
 * computer keyboard has no true velocity, so notes use a fixed configurable
 * velocity (default 0.7); nothing fake is invented.
 *
 * Default layout (one octave + octave shift):
 *   A W S E D F T G Y H U J   =  C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4
 *   Z = octave down, X = octave up  (QWERTY-local octave, -4..+4)
 *
 * The emitted note is `baseNote + keyIndex + octave*12` (baseNote = C4).
 * Everything else — engine octave shift, transpose, fine tuning, pitch bend,
 * sustain — flows through the existing engine transformations; nothing is
 * re-implemented here.
 *
 * Safety:
 * - keydown repeat and duplicate keydowns are ignored (one voice per key);
 *   a real keyup clears the key so the next physical press retriggers.
 * - Keys typed into input/textarea/select/contenteditable never play notes.
 * - Ctrl/Meta/Alt-modified presses never play notes (browser shortcuts).
 * - On window blur or tab-hide only the QWERTY-held notes are released —
 *   MIDI / mouse notes are untouched (each adapter owns its own emissions).
 * - keyup is never gated by the editable check, so focus moving into a
 *   text field mid-hold cannot leave a stuck note.
 */
export interface QwertyManagerOptions {
  /** e.key (lowercased) → chromatic index within the base octave. */
  keymap?: Readonly<Record<string, number>>
  /** Key that lowers the QWERTY octave (default 'z'). */
  octaveDownKey?: string
  /** Key that raises the QWERTY octave (default 'x'). */
  octaveUpKey?: string
  /** MIDI note of the first key in the base octave (default 60 = C4). */
  baseNote?: number
  octaveMin?: number
  octaveMax?: number
}

export type QwertyManagerEvent = { type: 'octave'; octave: number }

export type QwertyListener = (event: QwertyManagerEvent) => void

export const DEFAULT_KEYMAP: Readonly<Record<string, number>> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
}

export const DEFAULT_OCTAVE_DOWN_KEY = 'z'
export const DEFAULT_OCTAVE_UP_KEY = 'x'
export const DEFAULT_BASE_NOTE = 60
export const DEFAULT_OCTAVE_MIN = -4
export const DEFAULT_OCTAVE_MAX = 4
export const DEFAULT_KEYBOARD_VELOCITY = 0.7

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable], [contenteditable="true"]'

export class QwertyManager {
  private readonly keymap: Readonly<Record<string, number>>
  private readonly octaveDownKey: string
  private readonly octaveUpKey: string
  private readonly baseNote: number
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
    this.keymap = options.keymap ?? DEFAULT_KEYMAP
    this.octaveDownKey = options.octaveDownKey ?? DEFAULT_OCTAVE_DOWN_KEY
    this.octaveUpKey = options.octaveUpKey ?? DEFAULT_OCTAVE_UP_KEY
    this.baseNote = options.baseNote ?? DEFAULT_BASE_NOTE
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

  /** Fixed velocity for all QWERTY notes (0.01..1). No per-key velocity. */
  setVelocity(value: number): void {
    this.velocity = Math.max(0.01, Math.min(1, value))
  }

  /** QWERTY-local octave (clamped). Applied to new notes only. */
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

  /** Attach window listeners. Idempotent. */
  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onWindowBlur)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** Detach window listeners and release any held notes. */
  stop(): void {
    if (!this.started) return
    this.started = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onWindowBlur)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.releaseAll()
  }

  /** Release every QWERTY-held note (blur / tab-hide / panic). */
  releaseAll(): void {
    if (this.held.size === 0) return
    const at = performance.now()
    for (const note of this.held.values()) {
      this.bus.emit({ kind: 'note-off', note, source: 'keyboard', at })
    }
    this.held.clear()
  }

  dispose(): void {
    if (!this.disposed) {
      this.stop()
      this.disposed = true
      this.listeners.clear()
    }
  }

  // ---- internals -----------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.started || this.disposed) return
    // Browser shortcuts (Ctrl/Cmd/Alt combos) must never play notes.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Never play while the user is typing into an editable control.
    if (this.isEditableTarget(e.target) || this.isEditableTarget(document.activeElement)) return

    const key = e.key.toLowerCase()

    if (key === this.octaveDownKey) {
      e.preventDefault()
      if (this.octave > this.octaveMin) this.setOctave(this.octave - 1)
      return
    }
    if (key === this.octaveUpKey) {
      e.preventDefault()
      if (this.octave < this.octaveMax) this.setOctave(this.octave + 1)
      return
    }

    const index = this.keymap[key]
    if (index === undefined) return
    // Hold protection: OS key-repeat and duplicate keydowns never re-trigger.
    if (e.repeat || this.held.has(key)) return
    e.preventDefault()

    const note = this.baseNote + index + this.octave * 12
    this.held.set(key, note)
    this.bus.emit({ kind: 'note-on', note, velocity: this.velocity, source: 'keyboard', at: e.timeStamp })
  }

  /** Never gated by the editable check: focus changes must not stick notes. */
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (!this.started || this.disposed) return
    const key = e.key.toLowerCase()
    const note = this.held.get(key)
    if (note === undefined) return
    this.held.delete(key)
    this.bus.emit({ kind: 'note-off', note, source: 'keyboard', at: e.timeStamp })
  }

  private readonly onWindowBlur = (): void => {
    this.releaseAll()
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.releaseAll()
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return target.closest(EDITABLE_SELECTOR) !== null
  }

  private emit(event: QwertyManagerEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }
}

let manager: QwertyManager | null = null

/** Module singleton: one adapter per app lifetime, survives React remounts. */
export function getQwertyManager(bus: NoteEventBus): QwertyManager {
  if (!manager) manager = new QwertyManager(bus)
  return manager
}
