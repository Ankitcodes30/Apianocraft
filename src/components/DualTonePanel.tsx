import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'
import { DEFAULT_DUAL_TONE_SNAPSHOT } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ResetButton } from './ResetButton'
import { formatOctaveValue, formatTransposeValue, formatTuningValue, shiftBadgeStyle } from '../utils/formatters'

interface DualReadout {
  enabled: boolean
  instrument: string
  volume: number
  pan: number
  cutoffNorm: number
  cutoffHz: number
  releaseTime: number
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
    cutoffNorm: dt?.cutoffNorm ?? 1,
    cutoffHz: dt?.cutoffHz ?? 20000,
    releaseTime: dt?.releaseTime ?? 0.3,
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
          prev.cutoffNorm === next.cutoffNorm &&
          prev.cutoffHz === next.cutoffHz &&
          prev.releaseTime === next.releaseTime &&
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

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    void engine.setDualInstrument(id)
    setOut((prev) => ({ ...prev, instrument: id }))
  }

  const handleBalanceChange = (val: number) => {
    const total = (engine.getDiagnostics().mainTone?.volume ?? 1) + (engine.getDiagnostics().dualTone?.volume ?? 1)
    const safeTotal = total > 0 ? total : 1.5
    engine.setMainToneVolume(safeTotal * (1 - val))
    engine.setDualToneVolume(safeTotal * val)
    setOut(snap(engine))
  }

  const handleResetLayerBSound = () => {
    engine.setDualToneVolume(DEFAULT_DUAL_TONE_SNAPSHOT.volume)
    engine.setDualTonePan(DEFAULT_DUAL_TONE_SNAPSHOT.pan)
    engine.setDualToneCutoff(DEFAULT_DUAL_TONE_SNAPSHOT.cutoffNorm)
    engine.setDualToneAttack(DEFAULT_DUAL_TONE_SNAPSHOT.attackTime ?? 0.005)
    engine.setDualToneRelease(DEFAULT_DUAL_TONE_SNAPSHOT.releaseTime ?? 0.3)
    engine.setDualOctaveShift(0)
    engine.setDualTranspose(0)
    engine.setDualTuningCents(0)
    setOut(snap(engine))
  }

  const handleResetLayerBEffects = () => {
    engine.setDualToneReverbAmount(DEFAULT_DUAL_TONE_SNAPSHOT.reverbAmount)
    engine.setDualToneReverbPreset(DEFAULT_DUAL_TONE_SNAPSHOT.reverbPreset)
    engine.setDualToneChorusAmount(DEFAULT_DUAL_TONE_SNAPSHOT.chorusAmount)
    engine.setDualToneDelayAmount(DEFAULT_DUAL_TONE_SNAPSHOT.delayAmount)
    engine.setDualToneDelayTime(DEFAULT_DUAL_TONE_SNAPSHOT.delayTime)
    engine.setDualToneDelayFeedback(DEFAULT_DUAL_TONE_SNAPSHOT.delayFeedback)
    setOut(snap(engine))
  }

  const instruments = engine.getInstruments()

  return (
    <Card
      className={`dt mt border-border transition-all ${out.enabled ? 'mt--dual-active' : 'opacity-90'}`}
      data-testid="dual-tone-panel"
      aria-label="Dual tone controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">DUAL TONE (LAYER B)</span>
          <Badge
            variant={out.enabled ? 'accent' : 'outline'}
            className={`mt-badge ${out.enabled ? '' : 'mt-badge--subtle'}`}
          >
            {out.enabled ? 'Layer B Active' : 'Off'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={out.enabled ? 'on' : 'outline'}
            size="sm"
            className={`btn ${out.enabled ? 'btn--on' : ''}`}
            data-testid="dual-tone-toggle-btn"
            onClick={() => {
              engine.setDualToneEnabled(!out.enabled)
              setOut(snap(engine))
            }}
          >
            Layer {out.enabled ? 'ON' : 'OFF'}
          </Button>
          {out.enabled && (
            <Select
              value={out.instrument}
              onChange={handleInstrumentChange}
              className="chip select w-40 text-xs"
              data-testid="layer-b-instrument-select"
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </CardHeader>

      {out.enabled && (
        <CardContent className="p-3 pt-0">
          <div className="mt-grid flex gap-3 flex-wrap">
            {/* Sub-Card 1: Layer B Sound Source & Layer Balance */}
            <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span>Layer B — Sound Control</span>
                  <ResetButton
                    onReset={handleResetLayerBSound}
                    title="Reset Layer B Sound Control to Default"
                    ariaLabel="Reset Layer B Sound Control to Default"
                    dataTestId="reset-layerb-sound"
                  />
                </div>
                <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                  {cutoffLabel(out.cutoffHz)}
                </Badge>
              </div>

              <div className="mt__row flex flex-wrap gap-2.5 items-center">
                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Layer B Vol</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone volume"
                    data-dual-vol
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.volume}
                    onChange={(e) => engine.setDualToneVolume(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-vol-out>
                    {Math.round(out.volume * 100)}%
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Layer Mix (A ↔ B)</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Layer balance A B"
                    data-layer-balance
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.layerBalance}
                    onChange={(e) => handleBalanceChange(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-layer-balance-out>
                    {Math.round((1 - out.layerBalance) * 100)}A / {Math.round(out.layerBalance * 100)}B
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Pan</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone pan"
                    data-dual-pan
                    min={-1}
                    max={1}
                    step={0.01}
                    value={out.pan}
                    onChange={(e) => engine.setDualTonePan(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-pan-out>
                    {panLabel(out.pan)}
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Cutoff</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone cutoff"
                    data-dual-cutoff
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.cutoffNorm}
                    onChange={(e) => engine.setDualToneCutoff(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-cutoff-out>
                    {cutoffLabel(out.cutoffHz)}
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Release</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone release envelope"
                    data-dual-release
                    min={0.01}
                    max={4}
                    step={0.01}
                    value={out.releaseTime}
                    onChange={(e) => engine.setDualToneRelease(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-release-out>
                    {out.releaseTime.toFixed(2)}s
                  </span>
                </label>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Octave</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-dual-oct-down onClick={() => engine.setDualOctaveShift(engine.dualOctave - 1)}>
                      −
                    </Button>
                    <Badge variant="secondary" className={shiftBadgeStyle(out.octave)} data-dual-oct-value>
                      {formatOctaveValue(out.octave)}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-dual-oct-up onClick={() => engine.setDualOctaveShift(engine.dualOctave + 1)}>
                      +
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                      data-dual-oct-reset
                      title="Reset Layer B Octave to 0"
                      aria-label="Reset Layer B Octave to 0"
                      onClick={() => engine.setDualOctaveShift(0)}
                    >
                      ↺
                    </Button>
                  </div>
                </div>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Transpose</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-dual-tr-down onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones - 1)}>
                      −
                    </Button>
                    <Badge variant="secondary" className={shiftBadgeStyle(out.transpose)} data-dual-tr-value>
                      {formatTransposeValue(out.transpose)}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-dual-tr-up onClick={() => engine.setDualTranspose(engine.dualTransposeSemitones + 1)}>
                      +
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                      data-dual-tr-reset
                      title="Reset Layer B Transpose to 0"
                      aria-label="Reset Layer B Transpose to 0"
                      onClick={() => engine.setDualTranspose(0)}
                    >
                      ↺
                    </Button>
                  </div>
                </div>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Tune</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-1.5 text-xs"
                      data-dual-tune-down
                      onClick={() => engine.setDualTuningCents(engine.dualTuningCents - 10)}
                    >
                      −10
                    </Button>
                    <Badge variant="secondary" className={shiftBadgeStyle(out.tuning)} data-dual-tune-value>
                      {formatTuningValue(out.tuning)}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-1.5 text-xs"
                      data-dual-tune-up
                      onClick={() => engine.setDualTuningCents(engine.dualTuningCents + 10)}
                    >
                      +10
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                      data-dual-tune-reset
                      title="Reset Layer B Tuning to 0¢"
                      aria-label="Reset Layer B Tuning to 0¢"
                      onClick={() => engine.setDualTuningCents(0)}
                    >
                      ↺
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Card 2: Layer B Effects Chain */}
            <div className="mt-card mt-card--fx flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span>Layer B — Effects & Ambience</span>
                  <ResetButton
                    onReset={handleResetLayerBEffects}
                    title="Reset Layer B Effects & Ambience to Default"
                    ariaLabel="Reset Layer B Effects & Ambience to Default"
                    dataTestId="reset-layerb-effects"
                  />
                </div>
                <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                  {out.reverbAmount > 0 || out.chorusAmount > 0 || out.delayAmount > 0 ? 'FX Active' : 'Dry'}
                </Badge>
              </div>

              <div className="mt__row mt__row--effects flex flex-wrap gap-2.5 items-center">
                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Reverb</span>
                  <Select
                    className="chip select mt__preset h-6 text-[11px] py-0 px-1 mb-1"
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
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone reverb amount"
                    data-dual-reverb
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.reverbAmount}
                    onChange={(e) => engine.setDualToneReverbAmount(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-reverb-out>
                    {Math.round(out.reverbAmount * 100)}%
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Chorus</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone chorus amount"
                    data-dual-chorus
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.chorusAmount}
                    onChange={(e) => engine.setDualToneChorusAmount(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-chorus-out>
                    {Math.round(out.chorusAmount * 100)}%
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Delay</span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone delay amount"
                    data-dual-delay-amt
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.delayAmount}
                    onChange={(e) => engine.setDualToneDelayAmount(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-delay-out>
                    {Math.round(out.delayAmount * 100)}%
                  </span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone delay time"
                    data-dual-delay-time
                    min={0}
                    max={1}
                    step={0.01}
                    value={out.delayTime}
                    onChange={(e) => engine.setDualToneDelayTime(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-delay-time-out>
                    {Math.round(out.delayTime * 1000)} ms
                  </span>
                  <input
                    type="range"
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    aria-label="Dual tone delay feedback"
                    data-dual-delay-fb
                    min={0}
                    max={0.85}
                    step={0.01}
                    value={out.delayFeedback}
                    onChange={(e) => engine.setDualToneDelayFeedback(parseFloat(e.currentTarget.value))}
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-dual-delay-fb-out>
                    {Math.round(out.delayFeedback * 100)}%
                  </span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
