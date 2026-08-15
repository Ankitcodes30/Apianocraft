import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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
    instrument: engine.instrumentId,
  }
}

const panLabel = (pan: number): string => {
  if (pan === 0) return 'Center'
  return `${pan > 0 ? 'R' : 'L'}${Math.round(Math.abs(pan) * 100)}`
}

const cutoffLabel = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`)

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
    <Card className="mt border-[#3A3A3A] bg-[#242424]" aria-label="Main tone controls">
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="mt__title flex items-center gap-2">
          <span className="font-semibold text-xs text-[#F2F2F2]">MAIN TONE (LAYER A)</span>
          <Badge variant="accent" className="mt-badge bg-[#29323C] text-[#F2F2F2] border-[#4A5D70]">Primary</Badge>
        </div>
        <Select
          className="chip select w-40 text-xs font-medium bg-[#292929] border-[#3A3A3A] text-[#F2F2F2]"
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
        </Select>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        <div className="mt-grid flex gap-2.5 flex-wrap">
          {/* Primary Channel Strip */}
          <div className="mt-card flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
              <span>PRIMARY CHANNEL STRIP</span>
              <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                {cutoffLabel(out.cutoffHz)}
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2 items-center">
              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Volume</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-vol-out>
                    {Math.round(out.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Main tone volume"
                  data-vol
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={1}
                  onChange={(e) => engine.setMainToneVolume(parseFloat(e.currentTarget.value))}
                />
              </label>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Pan</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-pan-out>
                    {panLabel(out.pan)}
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Main tone pan"
                  data-pan
                  min={-1}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  onChange={(e) => engine.setMainTonePan(parseFloat(e.currentTarget.value))}
                />
              </label>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Cutoff</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-cutoff-out>
                    {cutoffLabel(out.cutoffHz)}
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Main tone cutoff"
                  data-cutoff
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={1}
                  onChange={(e) => engine.setMainToneCutoff(parseFloat(e.currentTarget.value))}
                />
              </label>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Octave</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-oct-down onClick={() => engine.setOctaveShift(engine.octave - 1)}>
                    −
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-oct-up onClick={() => engine.setOctaveShift(engine.octave + 1)}>
                    +
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-oct-reset onClick={() => engine.setOctaveShift(0)}>
                    0
                  </Button>
                  <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-oct-value>
                    {out.octave > 0 ? '+' : ''}
                    {out.octave}
                  </Badge>
                </div>
              </div>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Transpose</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-tr-down onClick={() => engine.setTranspose(engine.transposeSemitones - 1)}>
                    −
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-tr-up onClick={() => engine.setTranspose(engine.transposeSemitones + 1)}>
                    +
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-tr-reset onClick={() => engine.setTranspose(0)}>
                    0
                  </Button>
                  <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-tr-value>
                    {out.transpose > 0 ? '+' : ''}
                    {out.transpose}
                  </Badge>
                </div>
              </div>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Fine Tune</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-5 px-1 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    data-tune-down
                    onClick={() => engine.setTuningCents(engine.tuningCents - 10)}
                  >
                    −10
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-5 px-1 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    data-tune-up
                    onClick={() => engine.setTuningCents(engine.tuningCents + 10)}
                  >
                    +10
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-tune-reset onClick={() => engine.setTuningCents(0)}>
                    0
                  </Button>
                  <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-tune-value>
                    {out.tuning > 0 ? '+' : ''}
                    {out.tuning}¢
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Effects Send Bus */}
          <div className="mt-card mt-card--fx flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
              <span>EFFECTS SEND BUS</span>
              <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                {out.reverbAmount > 0 || out.chorusAmount > 0 || out.delayAmount > 0 ? 'FX ACTIVE' : 'DRY'}
              </Badge>
            </div>

            <div className="mt__row mt__row--effects flex flex-wrap gap-2 items-center">
              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Reverb</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-reverb-out>
                    {Math.round(out.reverbAmount * 100)}%
                  </span>
                </div>
                <Select
                  className="chip select mt__preset h-5 text-[10px] py-0 px-1 mb-0.5 w-28 bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
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
                </Select>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Reverb amount"
                  data-reverb
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  onChange={(e) => engine.setMainToneReverbAmount(parseFloat(e.currentTarget.value))}
                />
              </label>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Chorus</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-chorus-out>
                    {Math.round(out.chorusAmount * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Chorus amount"
                  data-chorus
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  onChange={(e) => engine.setMainToneChorusAmount(parseFloat(e.currentTarget.value))}
                />
              </label>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Delay Amt</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-delay-out>
                    {Math.round(out.delayAmount * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Delay amount"
                  data-delay-amt
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  onChange={(e) => engine.setMainToneDelayAmount(parseFloat(e.currentTarget.value))}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="font-medium text-[9px]">Time</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-delay-time-out>
                    {Math.round(out.delayTime * 1000)} ms
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Delay time"
                  data-delay-time
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.35}
                  onChange={(e) => engine.setMainToneDelayTime(parseFloat(e.currentTarget.value))}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="font-medium text-[9px]">Feedback</span>
                  <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-delay-fb-out>
                    {Math.round(out.delayFeedback * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                  aria-label="Delay feedback"
                  data-delay-fb
                  min={0}
                  max={0.85}
                  step={0.01}
                  defaultValue={0.3}
                  onChange={(e) => engine.setMainToneDelayFeedback(parseFloat(e.currentTarget.value))}
                />
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
