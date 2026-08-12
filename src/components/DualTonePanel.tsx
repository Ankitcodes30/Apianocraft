import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'

interface DualReadout {
  enabled: boolean
  instrument: string
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
}

const READOUT_MS = 120

const snap = (engine: AudioEngine): DualReadout => {
  const d = engine.getDiagnostics()
  const dt = d.dualTone
  return {
    enabled: d.dualEnabled ?? false,
    instrument: d.dualInstrument ?? 'grand-piano',
    volume: dt?.volume ?? 1,
    pan: dt?.pan ?? 0,
    cutoffHz: dt?.cutoffHz ?? 20000,
    reverbAmount: dt?.reverbAmount ?? 0,
    reverbPreset: dt?.reverbPreset ?? 'room',
    chorusAmount: dt?.chorusAmount ?? 0,
    delayAmount: dt?.delayAmount ?? 0,
    delayTime: dt?.delayTime ?? 0.35,
    delayFeedback: dt?.delayFeedback ?? 0.3,
    octave: d.dualOctaveShift ?? 0,
    transpose: d.dualTranspose ?? 0,
    tuning: d.dualTuningCents ?? 0,
  }
}

const panLabel = (pan: number): string => {
  if (pan === 0) return 'Center'
  return `${pan > 0 ? 'R' : 'L'}${Math.round(Math.abs(pan) * 100)}`
}

const cutoffLabel = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`)

export function DualTonePanel({ engine }: { engine: AudioEngine }) {
  const renderBox = useRef({ count: 0 })
  renderBox.current.count += 1

  const [out, setOut] = useState<DualReadout>(() => snap(engine))

  useEffect(() => {
    const w = window as unknown as { __apiano?: Record<string, unknown> }
    w.__apiano = w.__apiano ?? {}
    w.__apiano.dualToneRenders = renderBox.current
    const id = window.setInterval(() => {
      setOut((prev) => {
        const next = snap(engine)
        return prev.enabled === next.enabled &&
          prev.instrument === next.instrument &&
          prev.volume === next.volume &&
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
          prev.tuning === next.tuning
          ? prev
          : next
      })
    }, READOUT_MS)
    return () => window.clearInterval(id)
  }, [engine])

  return (
    <section className={`mt${out.enabled ? ' mt--dual-active' : ''}`} aria-label="Dual tone controls">
      <div className="mt__head">
        <span className="mt__title">DUAL TONE</span>
        <button
          type="button"
          className={`btn${out.enabled ? ' btn--on' : ''}`}
          data-dual-toggle
          onClick={() => engine.setDualToneEnabled(!out.enabled)}
        >
          Layer {out.enabled ? 'ON' : 'OFF'}
        </button>
        <select
          className="chip select"
          aria-label="Dual Tone Instrument"
          data-dual-instrument
          value={out.instrument}
          disabled={!out.enabled}
          onChange={(e) => void engine.setDualInstrument(e.target.value)}
        >
          {engine.getInstruments().map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      {out.enabled && (
        <>
          <div className="mt__row">
            <label className="mt__ctl">
              <span>Volume</span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone volume"
                data-dual-vol
                min={0}
                max={1}
                step={0.01}
                defaultValue={out.volume}
                onChange={(e) => engine.setDualToneVolume(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-vol-out>
                {Math.round(out.volume * 100)}%
              </span>
            </label>

            <label className="mt__ctl">
              <span>Pan</span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone pan"
                data-dual-pan
                min={-1}
                max={1}
                step={0.01}
                defaultValue={out.pan}
                onChange={(e) => engine.setDualTonePan(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-pan-out>
                {panLabel(out.pan)}
              </span>
            </label>

            <label className="mt__ctl">
              <span>Cutoff</span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone cutoff"
                data-dual-cutoff
                min={0}
                max={1}
                step={0.01}
                defaultValue={1}
                onChange={(e) => engine.setDualToneCutoff(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-cutoff-out>
                {cutoffLabel(out.cutoffHz)}
              </span>
            </label>

            <div className="mt__ctl mt__stepper">
              <span>Octave</span>
              <button type="button" className="btn" data-dual-oct-down onClick={() => engine.setDualOctaveShift(engine.dualOctave - 1)}>
                −
              </button>
              <button type="button" className="btn" data-dual-oct-up onClick={() => engine.setDualOctaveShift(engine.dualOctave + 1)}>
                +
              </button>
              <button type="button" className="btn" data-dual-oct-reset onClick={() => engine.setDualOctaveShift(0)}>
                0
              </button>
              <span className="chip" data-dual-oct-value>
                {out.octave > 0 ? '+' : ''}
                {out.octave}
              </span>
            </div>

            <div className="mt__ctl mt__stepper">
              <span>Transpose</span>
              <button type="button" className="btn" data-dual-tr-down onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones - 1)}>
                −
              </button>
              <button type="button" className="btn" data-dual-tr-up onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones + 1)}>
                +
              </button>
              <button type="button" className="btn" data-dual-tr-reset onClick={() => engine.setDualTranspose(0)}>
                0
              </button>
              <span className="chip" data-dual-tr-value>
                {out.transpose > 0 ? '+' : ''}
                {out.transpose}
              </span>
            </div>

            <div className="mt__ctl mt__stepper">
              <span>Tune</span>
              <button
                type="button"
                className="btn"
                data-dual-tune-down
                onClick={() => engine.setDualTuningCents(engine.dualTuningCents - 10)}
              >
                −10
              </button>
              <button
                type="button"
                className="btn"
                data-dual-tune-up
                onClick={() => engine.setDualTuningCents(engine.dualTuningCents + 10)}
              >
                +10
              </button>
              <button type="button" className="btn" data-dual-tune-reset onClick={() => engine.setDualTuningCents(0)}>
                0
              </button>
              <span className="chip" data-dual-tune-value>
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
                aria-label="Dual tone reverb preset"
                data-dual-reverb-preset
                value={out.reverbPreset}
                onChange={(e) => engine.setDualToneReverbPreset(e.currentTarget.value)}
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
                aria-label="Dual tone reverb amount"
                data-dual-reverb
                min={0}
                max={1}
                step={0.01}
                defaultValue={out.reverbAmount}
                onChange={(e) => engine.setDualToneReverbAmount(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-reverb-out>
                {Math.round(out.reverbAmount * 100)}%
              </span>
            </label>

            <label className="mt__ctl">
              <span>Chorus</span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone chorus amount"
                data-dual-chorus
                min={0}
                max={1}
                step={0.01}
                defaultValue={out.chorusAmount}
                onChange={(e) => engine.setDualToneChorusAmount(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-chorus-out>
                {Math.round(out.chorusAmount * 100)}%
              </span>
            </label>

            <label className="mt__ctl">
              <span>Delay</span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone delay amount"
                data-dual-delay-amt
                min={0}
                max={1}
                step={0.01}
                defaultValue={out.delayAmount}
                onChange={(e) => engine.setDualToneDelayAmount(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-delay-out>
                {Math.round(out.delayAmount * 100)}%
              </span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone delay time"
                data-dual-delay-time
                min={0}
                max={1}
                step={0.01}
                defaultValue={out.delayTime}
                onChange={(e) => engine.setDualToneDelayTime(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-delay-time-out>
                {Math.round(out.delayTime * 1000)} ms
              </span>
              <input
                type="range"
                className="mt__slider"
                aria-label="Dual tone delay feedback"
                data-dual-delay-fb
                min={0}
                max={0.85}
                step={0.01}
                defaultValue={out.delayFeedback}
                onChange={(e) => engine.setDualToneDelayFeedback(parseFloat(e.currentTarget.value))}
              />
              <span className="mt__out" data-dual-delay-fb-out>
                {Math.round(out.delayFeedback * 100)}%
              </span>
            </label>
          </div>
        </>
      )}
    </section>
  )
}
