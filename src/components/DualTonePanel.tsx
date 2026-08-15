import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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
  layerBalance: number
}

const READOUT_MS = 120

const snap = (engine: AudioEngine): DualReadout => {
  const d = engine.getDiagnostics()
  const dt = d.dualTone
  const mainVol = d.mainTone?.volume ?? 1
  const dualVol = dt?.volume ?? 1
  const total = mainVol + dualVol
  const balance = total > 0 ? dualVol / total : 0.5

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
    layerBalance: Math.round(balance * 100) / 100,
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
          prev.tuning === next.tuning &&
          prev.layerBalance === next.layerBalance
          ? prev
          : next
      })
    }, READOUT_MS)
    return () => window.clearInterval(id)
  }, [engine])

  const handleBalanceChange = (val: number) => {
    const mainVol = (1 - val) * 2
    const dualVol = val * 2
    engine.setMainToneVolume(Math.min(1, mainVol))
    engine.setDualToneVolume(Math.min(1, dualVol))
  }

  return (
    <Card
      className={`dt mt border-[#3A3A3A] bg-[#242424] transition-all ${
        out.enabled ? 'border-[#5B7FA3]' : ''
      }`}
      aria-label="Dual tone controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="mt__title flex items-center gap-2">
          <span className="font-semibold text-xs text-[#F2F2F2]">DUAL TONE (LAYER B)</span>
          <Badge
            variant={out.enabled ? 'accent' : 'outline'}
            className={`mt-badge font-mono text-[9px] ${out.enabled ? 'bg-[#29323C] text-[#F2F2F2] border-[#4A5D70]' : 'text-[#B5B5B5] border-[#3A3A3A]'}`}
          >
            {out.enabled ? 'LAYER B ACTIVE' : 'OFF'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={out.enabled ? 'on' : 'outline'}
            size="sm"
            className={`btn ${out.enabled ? 'bg-[#5B7FA3] border-[#5B7FA3] text-white font-semibold' : 'bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]'}`}
            data-dual-toggle
            onClick={() => engine.setDualToneEnabled(!out.enabled)}
          >
            Layer B {out.enabled ? 'ON' : 'OFF'}
          </Button>
          <Select
            className="chip select w-40 text-xs font-medium bg-[#292929] border-[#3A3A3A] text-[#F2F2F2]"
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
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        {!out.enabled ? (
          /* Clean Disabled Layer B Banner */
          <div className="flex flex-row items-center justify-between py-2 px-3 bg-[#292929] rounded-[4px] border border-[#3A3A3A] text-xs gap-3">
            <span className="text-[#B5B5B5] font-medium text-[11px]">
              Blend a secondary instrument layer (e.g. Piano + Strings / Pad).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => engine.setDualToneEnabled(true)}
              className="text-xs font-semibold bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5] hover:bg-[#353535]"
            >
              + Enable Layer B
            </Button>
          </div>
        ) : (
          <div className="mt-grid flex gap-2.5 flex-wrap">
            {/* Layer B Channel Strip */}
            <div className="mt-card flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
                <span>LAYER B CHANNEL STRIP</span>
                <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                  {cutoffLabel(out.cutoffHz)}
                </Badge>
              </div>

              <div className="mt__row flex flex-wrap gap-2 items-center">
                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Layer B Vol</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-vol-out>
                      {Math.round(out.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone volume"
                    data-dual-vol
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.volume}
                    onChange={(e) => engine.setDualToneVolume(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Mix (A ↔ B)</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-layer-balance-out>
                      {Math.round((1 - out.layerBalance) * 100)}A / {Math.round(out.layerBalance * 100)}B
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Layer balance A B"
                    data-layer-balance
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.layerBalance}
                    onChange={(e) => handleBalanceChange(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Pan</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-pan-out>
                      {panLabel(out.pan)}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone pan"
                    data-dual-pan
                    min={-1}
                    max={1}
                    step={0.01}
                    defaultValue={out.pan}
                    onChange={(e) => engine.setDualTonePan(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Cutoff</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-cutoff-out>
                      {cutoffLabel(out.cutoffHz)}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone cutoff"
                    data-dual-cutoff
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={1}
                    onChange={(e) => engine.setDualToneCutoff(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                  <span className="font-medium text-[9px]">Octave</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-oct-down onClick={() => engine.setDualOctaveShift(engine.dualOctave - 1)}>
                      −
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-oct-up onClick={() => engine.setDualOctaveShift(engine.dualOctave + 1)}>
                      +
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-oct-reset onClick={() => engine.setDualOctaveShift(0)}>
                      0
                    </Button>
                    <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-dual-oct-value>
                      {out.octave > 0 ? '+' : ''}
                      {out.octave}
                    </Badge>
                  </div>
                </div>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                  <span className="font-medium text-[9px]">Transpose</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-tr-down onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones - 1)}>
                      −
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-tr-up onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones + 1)}>
                      +
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[11px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-tr-reset onClick={() => engine.setDualTranspose(0)}>
                      0
                    </Button>
                    <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-dual-tr-value>
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
                      data-dual-tune-down
                      onClick={() => engine.setDualTuningCents(engine.dualTuningCents - 10)}
                    >
                      −10
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-5 px-1 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                      data-dual-tune-up
                      onClick={() => engine.setDualTuningCents(engine.dualTuningCents + 10)}
                    >
                      +10
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="btn h-5 px-1.5 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]" data-dual-tune-reset onClick={() => engine.setDualTuningCents(0)}>
                      0
                    </Button>
                    <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-dual-tune-value>
                      {out.tuning > 0 ? '+' : ''}
                      {out.tuning}¢
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer B Effects */}
            <div className="mt-card mt-card--fx flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
                <span>LAYER B EFFECTS</span>
                <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                  {out.reverbAmount > 0 || out.chorusAmount > 0 || out.delayAmount > 0 ? 'FX ACTIVE' : 'DRY'}
                </Badge>
              </div>

              <div className="mt__row mt__row--effects flex flex-wrap gap-2 items-center">
                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Reverb</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-reverb-out>
                      {Math.round(out.reverbAmount * 100)}%
                    </span>
                  </div>
                  <Select
                    className="chip select mt__preset h-5 text-[10px] py-0 px-1 mb-0.5 w-28 bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
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
                  </Select>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone reverb amount"
                    data-dual-reverb
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.reverbAmount}
                    onChange={(e) => engine.setDualToneReverbAmount(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Chorus</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-chorus-out>
                      {Math.round(out.chorusAmount * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone chorus amount"
                    data-dual-chorus
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.chorusAmount}
                    onChange={(e) => engine.setDualToneChorusAmount(parseFloat(e.currentTarget.value))}
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[9px]">Delay Amt</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-delay-out>
                      {Math.round(out.delayAmount * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone delay amount"
                    data-dual-delay-amt
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.delayAmount}
                    onChange={(e) => engine.setDualToneDelayAmount(parseFloat(e.currentTarget.value))}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-medium text-[9px]">Time</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-delay-time-out>
                      {Math.round(out.delayTime * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone delay time"
                    data-dual-delay-time
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={out.delayTime}
                    onChange={(e) => engine.setDualToneDelayTime(parseFloat(e.currentTarget.value))}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-medium text-[9px]">Feedback</span>
                    <span className="mt__out font-mono text-xs text-[#F2F2F2] font-semibold tabular-nums" data-dual-delay-fb-out>
                      {Math.round(out.delayFeedback * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
                    aria-label="Dual tone delay feedback"
                    data-dual-delay-fb
                    min={0}
                    max={0.85}
                    step={0.01}
                    defaultValue={out.delayFeedback}
                    onChange={(e) => engine.setDualToneDelayFeedback(parseFloat(e.currentTarget.value))}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
