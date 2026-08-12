import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'

interface Readout {
  volume: number
  pan: number
  cutoffHz: number
  reverbAmount: number
  reverbPreset: ReverbPresetId
  chorusAmount: number
  delayAmount: number
  delayTime: number
  delayFeedback: number
  octave: number
  transpose: number
  tuning: number
  instrument: string
}

const READOUT_MS = 120

const snap = (engine: AudioEngine): Readout => {
  const d = engine.getDiagnostics()
  const mt = d.mainTone
  return {
    volume: mt?.volume ?? 1,
    pan: mt?.pan ?? 0,
    cutoffHz: mt?.cutoffHz ?? 20000,
    reverbAmount: mt?.reverbAmount ?? 0,
    reverbPreset: mt?.reverbPreset ?? 'room',
    chorusAmount: mt?.chorusAmount ?? 0,
    delayAmount: mt?.delayAmount ?? 0,
    delayTime: mt?.delayTime ?? 0.35,
    delayFeedback: mt?.delayFeedback ?? 0.3,
    octave: d.octaveShift,
    transpose: d.transpose,
    tuning: d.tuningCents,
    instrument: d.instrument,
  }
}

const panLabel = (pan: number): string => {
  if (pan === 0) return 'Center'
  return `${pan > 0 ? 'R' : 'L'}${Math.round(Math.abs(pan) * 100)}`
}

const cutoffLabel = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`)

/**
 * Main Tone control panel. Audio parameters go straight to the engine from
 * the slider handlers; the readout polls a throttled snapshot, so dragging a
 * slider never triggers a React render per input event.
 */
export function MainTonePanel({ engine }: { engine: AudioEngine }) {
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1

  const [out, setOut] = useState<Readout>(() => snap(engine))

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.mainToneRenders = renderBox.current
    const id = window.setInterval(() => {
      setOut((prev) => {
        const next = snap(engine)
        return prev.volume === next.volume &&
          prev.pan === next.pan &&
          prev.cutoffHz === next.cutoffHz &&
          prev.reverbAmount === next.reverbAmount &&
          prev.reverbPreset === next.reverbPreset &&
          prev.chorusAmount === next.chorusAmount &&
          prev.delayAmount === next.delayAmount &&
          prev.delayTime === next.delayTime &&
          prev.delayFeedback === next.delayFeedback &&
          prev.octave === next.octave &&
          prev.transpose === next.transpose &&
          prev.tuning === next.tuning &&
          prev.instrument === next.instrument
          ? prev
          : next
      })
    }, READOUT_MS)
    return () => window.clearInterval(id)
  }, [engine])

  return (
    <section className="mt" aria-label="Main tone controls">
      <div className="mt__head">
        <span className="mt__title">MAIN TONE</span>
        <select
          className="chip select"
          aria-label="Main Tone Instrument"
          data-instrument-select
          value={out.instrument}
          onChange={(e) => void engine.setInstrument(e.target.value)}
        >
          {engine.getInstruments().map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt__row">
        <label className="mt__ctl">
          <span>Volume</span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Main tone volume"
            data-vol
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            onChange={(e) => engine.setMainToneVolume(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-vol-out>
            {Math.round(out.volume * 100)}%
          </span>
        </label>

        <label className="mt__ctl">
          <span>Pan</span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Main tone pan"
            data-pan
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0}
            onChange={(e) => engine.setMainTonePan(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-pan-out>
            {panLabel(out.pan)}
          </span>
        </label>

        <label className="mt__ctl">
          <span>Cutoff</span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Main tone cutoff"
            data-cutoff
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            onChange={(e) => engine.setMainToneCutoff(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-cutoff-out>
            {cutoffLabel(out.cutoffHz)}
          </span>
        </label>

        <div className="mt__ctl mt__stepper">
          <span>Octave</span>
          <button type="button" className="btn" data-oct-down onClick={() => engine.setOctaveShift(engine.octave - 1)}>
            −
          </button>
          <button type="button" className="btn" data-oct-up onClick={() => engine.setOctaveShift(engine.octave + 1)}>
            +
          </button>
          <button type="button" className="btn" data-oct-reset onClick={() => engine.setOctaveShift(0)}>
            0
          </button>
          <span className="chip" data-oct-value>
            {out.octave > 0 ? '+' : ''}
            {out.octave}
          </span>
        </div>

        <div className="mt__ctl mt__stepper">
          <span>Transpose</span>
          <button type="button" className="btn" data-tr-down onClick={() => engine.setTranspose(engine.transposeSemitones - 1)}>
            −
          </button>
          <button type="button" className="btn" data-tr-up onClick={() => engine.setTranspose(engine.transposeSemitones + 1)}>
            +
          </button>
          <button type="button" className="btn" data-tr-reset onClick={() => engine.setTranspose(0)}>
            0
          </button>
          <span className="chip" data-tr-value>
            {out.transpose > 0 ? '+' : ''}
            {out.transpose}
          </span>
        </div>

        <div className="mt__ctl mt__stepper">
          <span>Tune</span>
          <button
            type="button"
            className="btn"
            data-tune-down
            onClick={() => engine.setTuningCents(engine.tuningCents - 10)}
          >
            −10
          </button>
          <button
            type="button"
            className="btn"
            data-tune-up
            onClick={() => engine.setTuningCents(engine.tuningCents + 10)}
          >
            +10
          </button>
          <button type="button" className="btn" data-tune-reset onClick={() => engine.setTuningCents(0)}>
            0
          </button>
          <span className="chip" data-tune-value>
            {out.tuning > 0 ? '+' : ''}
            {out.tuning}¢
          </span>
        </div>
      </div>

      <div className="mt__row mt__row--effects">
        <span className="mt__group-label">Effects</span>

        <label className="mt__ctl">
          <span>Reverb</span>
          <select
            className="chip select mt__preset"
            aria-label="Reverb preset"
            data-reverb-preset
            value={out.reverbPreset}
            onChange={(e) => engine.setMainToneReverbPreset(e.currentTarget.value)}
          >
            {REVERB_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="range"
            className="mt__slider"
            aria-label="Reverb amount"
            data-reverb
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onChange={(e) => engine.setMainToneReverbAmount(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-reverb-out>
            {Math.round(out.reverbAmount * 100)}%
          </span>
        </label>

        <label className="mt__ctl">
          <span>Chorus</span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Chorus amount"
            data-chorus
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onChange={(e) => engine.setMainToneChorusAmount(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-chorus-out>
            {Math.round(out.chorusAmount * 100)}%
          </span>
        </label>

        <label className="mt__ctl">
          <span>Delay</span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Delay amount"
            data-delay-amt
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onChange={(e) => engine.setMainToneDelayAmount(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-delay-out>
            {Math.round(out.delayAmount * 100)}%
          </span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Delay time"
            data-delay-time
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.35}
            onChange={(e) => engine.setMainToneDelayTime(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-delay-time-out>
            {Math.round(out.delayTime * 1000)} ms
          </span>
          <input
            type="range"
            className="mt__slider"
            aria-label="Delay feedback"
            data-delay-fb
            min={0}
            max={0.85}
            step={0.01}
            defaultValue={0.3}
            onChange={(e) => engine.setMainToneDelayFeedback(parseFloat(e.currentTarget.value))}
          />
          <span className="mt__out" data-delay-fb-out>
            {Math.round(out.delayFeedback * 100)}%
          </span>
        </label>
      </div>
    </section>
  )
}
