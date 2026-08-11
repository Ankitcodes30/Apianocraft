import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { PerformanceControls } from '../performance/PerformanceControls'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Per-frame exponential decay of pitch bend during self-centering. */
const SELF_CENTER_DECAY = 0.78
const SELF_CENTER_EPS = 0.004
/** Readout refresh cadence — low-priority text, not the control path. */
const READOUT_MS = 120
/** Keyboard step per arrow key press (normalized units). */
const KEY_STEP = 0.1

/**
 * Performance XY pad — pitch bend (X) + modulation (Y).
 *
 *   Mouse/Touchpad/Touch → pointer events → PerformancePad →
 *   PerformanceControls → engine pitch-bend/modulation → voices
 *
 * High-frequency path is React-free: pointer moves apply the control values
 * and move the dot via direct DOM writes (no setState, no per-event object
 * allocation). React only re-renders for throttled textual readouts (~8/s)
 * and the low-frequency range toggle.
 *
 * Pitch self-centers on release via the same engine pitch-bend path; the
 * engine's AudioParam automation (setTargetAtTime) makes the return glide
 * click-free. Modulation latches at the last value (like a mod wheel).
 */
export function PerformancePad({ engine }: { engine: AudioEngine }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<PerformanceControls | null>(null)
  if (!controlsRef.current) controlsRef.current = new PerformanceControls(engine)

  const activePointer = useRef<number | null>(null)
  const bend = useRef(0)
  const mod = useRef(0)
  const raf = useRef(0)
  const rect = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1

  const [readout, setReadout] = useState(() => ({
    cents: engine.pitchBendCentsValue,
    mod: engine.modulationValue,
    range: engine.pitchBendRangeSemitones,
  }))

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.perfPadRenders = renderBox.current
    const id = window.setInterval(() => {
      setReadout((prev) => {
        const cents = engine.pitchBendCentsValue
        const mod = engine.modulationValue
        const range = engine.pitchBendRangeSemitones
        if (prev.cents === cents && prev.mod === mod && prev.range === range) return prev
        return { cents, mod, range }
      })
    }, READOUT_MS)
    return () => window.clearInterval(id)
  }, [engine])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /** Hot path: engine controls + direct DOM dot move. No React, no allocs. */
  const apply = (nextBend: number, nextMod: number): void => {
    bend.current = nextBend
    mod.current = nextMod
    const c = controlsRef.current
    if (!c) return
    c.pitchBend(nextBend)
    c.modulation(nextMod)
    const dot = dotRef.current
    if (dot) {
      const px = ((nextBend + 1) / 2) * 100
      const py = (1 - nextMod) * 100
      dot.style.left = `${px.toFixed(3)}%`
      dot.style.top = `${py.toFixed(3)}%`
      dot.setAttribute(
        'aria-valuetext',
        `pitch ${(nextBend * 100).toFixed(0)}%, modulation ${(nextMod * 100).toFixed(0)}%`,
      )
    }
  }

  const applyPointer = (clientX: number, clientY: number): void => {
    const r = rect.current
    if (!r) return
    const x = (clientX - r.left) / r.width
    const y = (clientY - r.top) / r.height
    apply(clamp(x, 0, 1) * 2 - 1, 1 - clamp(y, 0, 1))
  }

  /** Pitch bend glides back to center; modulation stays put. */
  const selfCenter = (): void => {
    cancelAnimationFrame(raf.current)
    const step = (): void => {
      const nb = bend.current * SELF_CENTER_DECAY
      if (Math.abs(nb) < SELF_CENTER_EPS) {
        apply(0, mod.current)
        return
      }
      apply(nb, mod.current)
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (activePointer.current !== null) return
    activePointer.current = e.pointerId
    cancelAnimationFrame(raf.current)
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    rect.current = { left: r.left, top: r.top, width: r.width, height: r.height }
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointer events (tests) have no capture target */
    }
    applyPointer(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerId !== activePointer.current) return
    applyPointer(e.clientX, e.clientY)
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerId !== activePointer.current) return
    activePointer.current = null
    selfCenter()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        apply(clamp(bend.current - KEY_STEP, -1, 1), mod.current)
        break
      case 'ArrowRight':
        e.preventDefault()
        apply(clamp(bend.current + KEY_STEP, -1, 1), mod.current)
        break
      case 'ArrowUp':
        e.preventDefault()
        apply(bend.current, clamp(mod.current + KEY_STEP, 0, 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        apply(bend.current, clamp(mod.current - KEY_STEP, 0, 1))
        break
      default:
        break
    }
  }

  const onKeyUp = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') selfCenter()
  }

  return (
    <div
      ref={rootRef}
      className="perf-pad"
      data-perf-pad
      role="slider"
      aria-label="Performance pad — horizontal: pitch bend, vertical: modulation"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(readout.cents)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <div className="perf-pad__center" aria-hidden="true" />
      <div className="perf-pad__label perf-pad__label--pb" aria-hidden="true">
        PB ← 0 →
      </div>
      <div className="perf-pad__label perf-pad__label--mod" aria-hidden="true">
        MOD ↑
      </div>
      <div
        ref={dotRef}
        className="perf-pad__dot"
        data-perf-dot
        style={{ left: '50%', top: '100%' }}
      />
      <div className="perf-pad__readout" data-perf-readout>
        {readout.cents > 0 ? '+' : ''}
        {Math.round(readout.cents)}¢ · mod {Math.round(readout.mod * 100)}% · {readout.range} st
      </div>
      <div className="perf-pad__range">
        <button
          type="button"
          className={readout.range === 2 ? 'perf-pad__range--on' : ''}
          data-bend-range="2"
          aria-pressed={readout.range === 2}
          onClick={() => controlsRef.current?.setPitchBendRange(2)}
        >
          ±2
        </button>
        <button
          type="button"
          className={readout.range === 12 ? 'perf-pad__range--on' : ''}
          data-bend-range="12"
          aria-pressed={readout.range === 12}
          onClick={() => controlsRef.current?.setPitchBendRange(12)}
        >
          ±12
        </button>
      </div>
    </div>
  )
}
