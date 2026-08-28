import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { ReverbPresetId } from '../audio/effects/MainToneChain'
import { REVERB_PRESETS } from '../audio/effects/MainToneChain'
import { DEFAULT_MAIN_TONE_SNAPSHOT } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ResetButton } from './ResetButton'
import { formatOctaveValue, formatTransposeValue, formatTuningValue, shiftBadgeStyle } from '../utils/formatters'

interface Readout {
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
  instrument: string
}

const READOUT_MS = 120

const snap = (engine: AudioEngine): Readout => {
  const d = engine.getDiagnostics()
  const mt = d.mainTone
  return {
    volume: mt?.volume ?? 1,
    pan: mt?.pan ?? 0,
    cutoffNorm: mt?.cutoffNorm ?? 1,
    cutoffHz: mt?.cutoffHz ?? 20000,
    releaseTime: mt?.releaseTime ?? 0.3,
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
          prev.instrument === next.instrument
          ? prev
          : next
      })
    }, READOUT_MS)
    return () => window.clearInterval(id)
  }, [engine])

  const handleResetPrimarySound = () => {
    engine.setMainToneVolume(DEFAULT_MAIN_TONE_SNAPSHOT.volume)
    engine.setMainTonePan(DEFAULT_MAIN_TONE_SNAPSHOT.pan)
    engine.setMainToneCutoff(DEFAULT_MAIN_TONE_SNAPSHOT.cutoffNorm)
    engine.setMainToneAttack(DEFAULT_MAIN_TONE_SNAPSHOT.attackTime ?? 0.005)
    engine.setMainToneRelease(DEFAULT_MAIN_TONE_SNAPSHOT.releaseTime ?? 0.3)
    engine.setOctaveShift(0)
    engine.setTranspose(0)
    engine.setTuningCents(0)
    setOut(snap(engine))
  }

  const handleResetLayerAEffects = () => {
    engine.setMainToneReverbAmount(DEFAULT_MAIN_TONE_SNAPSHOT.reverbAmount)
    engine.setMainToneReverbPreset(DEFAULT_MAIN_TONE_SNAPSHOT.reverbPreset)
    engine.setMainToneChorusAmount(DEFAULT_MAIN_TONE_SNAPSHOT.chorusAmount)
    engine.setMainToneDelayAmount(DEFAULT_MAIN_TONE_SNAPSHOT.delayAmount)
    engine.setMainToneDelayTime(DEFAULT_MAIN_TONE_SNAPSHOT.delayTime)
    engine.setMainToneDelayFeedback(DEFAULT_MAIN_TONE_SNAPSHOT.delayFeedback)
    setOut(snap(engine))
  }

  return (
    <Card className="mt border-border" aria-label="Main tone controls">
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">MAIN TONE (LAYER A)</span>
          <Badge variant="accent" className="mt-badge">Primary</Badge>
        </div>
        <Select
          className="chip select w-44 text-xs font-semibold"
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

      <CardContent className="p-3 pt-0">
        <div className="mt-grid flex gap-3 flex-wrap">
          {/* Sub-Card 1: Sound Source & Pitch Controls */}
          <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span>Primary Sound Controls</span>
                <ResetButton
                  onReset={handleResetPrimarySound}
                  title="Reset Primary Sound Controls to Default"
                  ariaLabel="Reset Primary Sound Controls to Default"
                  dataTestId="reset-main-primary"
                />
              </div>
              <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                {cutoffLabel(out.cutoffHz)}
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2.5 items-center">
              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Volume</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Main tone volume"
                  data-vol
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.volume}
                  onChange={(e) => engine.setMainToneVolume(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-vol-out>
                  {Math.round(out.volume * 100)}%
                </span>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Pan</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Main tone pan"
                  data-pan
                  min={-1}
                  max={1}
                  step={0.01}
                  value={out.pan}
                  onChange={(e) => engine.setMainTonePan(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-pan-out>
                  {panLabel(out.pan)}
                </span>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Cutoff</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Main tone cutoff"
                  data-cutoff
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.cutoffNorm}
                  onChange={(e) => engine.setMainToneCutoff(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-cutoff-out>
                  {cutoffLabel(out.cutoffHz)}
                </span>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Release</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Main tone release envelope"
                  data-release
                  min={0.01}
                  max={4}
                  step={0.01}
                  value={out.releaseTime}
                  onChange={(e) => engine.setMainToneRelease(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-release-out>
                  {out.releaseTime.toFixed(2)}s
                </span>
              </label>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Octave</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-oct-down onClick={() => engine.setOctaveShift(engine.octave - 1)}>
                    −
                  </Button>
                  <Badge variant="secondary" className={shiftBadgeStyle(out.octave)} data-oct-value>
                    {formatOctaveValue(out.octave)}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-oct-up onClick={() => engine.setOctaveShift(engine.octave + 1)}>
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                    data-oct-reset
                    title="Reset Octave to 0"
                    aria-label="Reset Octave to 0"
                    onClick={() => engine.setOctaveShift(0)}
                  >
                    ↺
                  </Button>
                </div>
              </div>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Transpose</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-tr-down onClick={() => engine.setTranspose(engine.transposeSemitones - 1)}>
                    −
                  </Button>
                  <Badge variant="secondary" className={shiftBadgeStyle(out.transpose)} data-tr-value>
                    {formatTransposeValue(out.transpose)}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" className="btn h-6 px-2 text-xs" data-tr-up onClick={() => engine.setTranspose(engine.transposeSemitones + 1)}>
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                    data-tr-reset
                    title="Reset Transpose to 0"
                    aria-label="Reset Transpose to 0"
                    onClick={() => engine.setTranspose(0)}
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
                    data-tune-down
                    onClick={() => engine.setTuningCents(engine.tuningCents - 10)}
                  >
                    −10
                  </Button>
                  <Badge variant="secondary" className={shiftBadgeStyle(out.tuning)} data-tune-value>
                    {formatTuningValue(out.tuning)}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 px-1.5 text-xs"
                    data-tune-up
                    onClick={() => engine.setTuningCents(engine.tuningCents + 10)}
                  >
                    +10
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                    data-tune-reset
                    title="Reset Tuning to 0¢"
                    aria-label="Reset Tuning to 0¢"
                    onClick={() => engine.setTuningCents(0)}
                  >
                    ↺
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Card 2: Master Effects Send Chain */}
          <div className="mt-card mt-card--fx flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span>Effects & Ambience</span>
                <ResetButton
                  onReset={handleResetLayerAEffects}
                  title="Reset Effects & Ambience to Default"
                  ariaLabel="Reset Effects & Ambience to Default"
                  dataTestId="reset-main-effects"
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
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Reverb amount"
                  data-reverb
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.reverbAmount}
                  onChange={(e) => engine.setMainToneReverbAmount(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-reverb-out>
                  {Math.round(out.reverbAmount * 100)}%
                </span>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Chorus</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Chorus amount"
                  data-chorus
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.chorusAmount}
                  onChange={(e) => engine.setMainToneChorusAmount(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-chorus-out>
                  {Math.round(out.chorusAmount * 100)}%
                </span>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Delay</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Delay amount"
                  data-delay-amt
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.delayAmount}
                  onChange={(e) => engine.setMainToneDelayAmount(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-delay-out>
                  {Math.round(out.delayAmount * 100)}%
                </span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Delay time"
                  data-delay-time
                  min={0}
                  max={1}
                  step={0.01}
                  value={out.delayTime}
                  onChange={(e) => engine.setMainToneDelayTime(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-delay-time-out>
                  {Math.round(out.delayTime * 1000)} ms
                </span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Delay feedback"
                  data-delay-fb
                  min={0}
                  max={0.85}
                  step={0.01}
                  value={out.delayFeedback}
                  onChange={(e) => engine.setMainToneDelayFeedback(parseFloat(e.currentTarget.value))}
                />
                <span className="mt__out font-mono text-[11px] text-foreground tabular-nums" data-delay-fb-out>
                  {Math.round(out.delayFeedback * 100)}%
                </span>
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
