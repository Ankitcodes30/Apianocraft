import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { getMousePerformanceAdapter, type MousePerfState } from '../performance/MousePerformanceAdapter'

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
 * Playable piano keyboard surface.
 * Active-note highlighting & Mouse Performance indicator are driven DIRECTLY
 * on the DOM from engine events / performance adapter (zero React re-renders).
 */
export function PianoKeyboard({ engine }: { engine: AudioEngine }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const indicatorRef = useRef<HTMLDivElement | null>(null)
  const pitchTextRef = useRef<HTMLSpanElement | null>(null)
  const modTextRef = useRef<HTMLSpanElement | null>(null)

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

  // Input events -> direct DOM class toggles on key lifecycle (zero release-tail latency).
  useEffect(() => {
    const apply = (notes: ReadonlySet<number>) => {
      for (const [note, el] of keyEls.current) {
        el.classList.toggle('ap-key--active', notes.has(note))
      }
    }
    apply(engine.getInputActiveNotes())
    return engine.subscribe((e) => {
      if (e.type === 'input-notes') apply(e.notes)
    })
  }, [engine])

  // Mouse performance adapter -> direct DOM updates for expression badge
  useEffect(() => {
    const adapter = getMousePerformanceAdapter()
    const updateIndicator = (state: MousePerfState) => {
      const el = indicatorRef.current
      if (!el) return
      if (state.enabled && state.active) {
        el.classList.add('mouse-perf-indicator--active')
        if (state.settling) {
          if (pitchTextRef.current) pitchTextRef.current.textContent = 'Mouse Perf: Settling...'
          if (modTextRef.current) modTextRef.current.textContent = ''
        } else {
          if (pitchTextRef.current) {
            const p = state.pitchBend >= 0 ? `+${state.pitchBend.toFixed(2)}` : state.pitchBend.toFixed(2)
            pitchTextRef.current.textContent = `Pitch: ${p}`
          }
          if (modTextRef.current) {
            modTextRef.current.textContent = `Mod: ${state.modulation.toFixed(2)}`
          }
        }
      } else {
        el.classList.remove('mouse-perf-indicator--active')
      }
    }
    updateIndicator(adapter.getState())
    return adapter.subscribe(updateIndicator)
  }, [])

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
      getMousePerformanceAdapter().reset()
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

  const onPointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    getMousePerformanceAdapter().handlePointerEnter(e.clientX, e.clientY)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = keyFromTarget(e.target)
    if (el) startNote(e.pointerId, el, e.clientY)
  }

  // Mouse performance pitch/mod expression + glissando note triggering
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    getMousePerformanceAdapter().handlePointerMove(e.clientX, e.clientY)

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
    getMousePerformanceAdapter().handlePointerLeave()
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
      onPointerEnter={onPointerEnter}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mouse-perf-indicator" ref={indicatorRef} data-mouse-perf-indicator>
        <span className="mouse-perf-indicator__badge">Mouse Performance</span>
        <span className="mouse-perf-indicator__val" ref={pitchTextRef} data-mouse-perf-pitch>
          Pitch: +0.00
        </span>
        <span className="mouse-perf-indicator__val" ref={modTextRef} data-mouse-perf-mod>
          Mod: 0.00
        </span>
      </div>

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
