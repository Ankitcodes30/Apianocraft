import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'

const START_NOTE = 36 // C2
const END_NOTE = 96 // C7 (5 octaves)
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const BLACK_IDX = new Set([1, 3, 6, 8, 10])

const WHITES: number[] = []
const BLACKS: { midi: number; leftWhite: number }[] = []
{
  let lastWhite = -1
  for (let n = START_NOTE; n <= END_NOTE; n++) {
    if (BLACK_IDX.has(n % 12)) BLACKS.push({ midi: n, leftWhite: lastWhite })
    else {
      lastWhite = WHITES.length
      WHITES.push(n)
    }
  }
}

const noteLabel = (midi: number) =>
  midi % 12 === 0 ? `C${midi / 12 - 1}` : NOTE_NAMES[midi % 12]

/**
 * Minimal mouse/touch-playable keyboard for engine validation.
 * Active-note highlighting is driven DIRECTLY on the DOM from engine events
 * (no React re-render on note events). Renders once; render count is exposed
 * for the smoke tests to verify render isolation.
 */
export function PianoKeyboard({ engine }: { engine: AudioEngine }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const keyEls = useRef(new Map<number, HTMLElement>())
  const held = useRef(new Map<number, number>())
  const engineRef = useRef(engine)
  engineRef.current = engine
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.keyboardRenders = renderBox.current
  }, [])

  // Engine events -> direct DOM class toggles. Audio drives the UI, never the reverse.
  useEffect(() => {
    const apply = (notes: ReadonlySet<number>) => {
      for (const [note, el] of keyEls.current) {
        el.classList.toggle('ap-key--active', notes.has(note))
      }
    }
    apply(engine.getActiveNotes())
    return engine.subscribe((e) => {
      if (e.type === 'active-notes') apply(e.notes)
    })
  }, [engine])

  // Safety: release everything on tab hide / pointer release anywhere.
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const midi = held.current.get(e.pointerId)
      if (midi !== undefined) {
        engineRef.current.noteOff({ note: midi })
        held.current.delete(e.pointerId)
      }
    }
    const releaseAll = () => {
      for (const midi of held.current.values()) engineRef.current.noteOff({ note: midi })
      held.current.clear()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.addEventListener('visibilitychange', releaseAll)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('visibilitychange', releaseAll)
    }
  }, [])

  const velocityAt = (el: HTMLElement, clientY: number) => {
    const r = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    return Math.max(0.08, 1 - t)
  }

  const keyFromTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    const el = target.closest<HTMLElement>('.ap-key')
    return el && rootRef.current?.contains(el) ? el : null
  }

  const startNote = (pointerId: number, el: HTMLElement, clientY: number) => {
    const midi = Number(el.dataset.midi)
    engineRef.current.noteOn({ note: midi, velocity: velocityAt(el, clientY), source: 'mouse' })
    held.current.set(pointerId, midi)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = keyFromTarget(e.target)
    if (el) startNote(e.pointerId, el, e.clientY)
  }

  // Glissando: while a pointer is held, sliding across keys retriggers notes.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cur = held.current.get(e.pointerId)
    if (cur === undefined) return
    const el = keyFromTarget(e.target)
    if (!el) {
      engineRef.current.noteOff({ note: cur })
      held.current.delete(e.pointerId)
      return
    }
    const midi = Number(el.dataset.midi)
    if (midi !== cur) {
      engineRef.current.noteOff({ note: cur })
      startNote(e.pointerId, el, e.clientY)
    }
  }

  const onPointerLeave = () => {
    for (const midi of held.current.values()) engineRef.current.noteOff({ note: midi })
    held.current.clear()
  }

  const setKeyRef = (midi: number) => (el: HTMLElement | null) => {
    if (el) keyEls.current.set(midi, el)
    else keyEls.current.delete(midi)
  }

  return (
    <div
      className="kb"
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="kb-whites">
        {WHITES.map((midi) => (
          <div
            key={midi}
            className={`ap-key ap-key--white${midi % 12 === 0 ? ' ap-key--c' : ''}`}
            data-midi={midi}
            ref={setKeyRef(midi)}
          >
            <span className="ap-key__label">{noteLabel(midi)}</span>
          </div>
        ))}
      </div>
      <div className="kb-blacks">
        {BLACKS.map(({ midi, leftWhite }) => (
          <div
            key={midi}
            className="ap-key ap-key--black"
            data-midi={midi}
            ref={setKeyRef(midi)}
            style={{
              left: `${((leftWhite + 0.62) / WHITES.length) * 100}%`,
              width: `${(0.42 / WHITES.length) * 100}%`,
            }}
          >
            <span className="ap-key__label">{NOTE_NAMES[midi % 12]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
