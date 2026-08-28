import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { SplitZoneSnapshot } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ResetButton } from './ResetButton'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function getNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave} (${midi})`
}

export const SplitPanel: React.FC = () => {
  const engine = getEngine()
  const [split, setSplit] = useState<SplitZoneSnapshot>(engine.splitZoneState())
  const [instruments, setInstruments] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    setInstruments(engine.getInstruments())
    const sub = engine.subscribe(() => {
      setSplit(engine.splitZoneState())
      setInstruments(engine.getInstruments())
    })
    return sub
  }, [engine])



  const handleSplitPoint = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    engine.setSplitPoint(val)
    setSplit(engine.splitZoneState())
  }

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void engine.setLowerInstrument(e.target.value)
    setSplit(engine.splitZoneState())
    e.target.blur()
  }

  const handleOctaveChange = (delta: number) => {
    engine.setLowerOctaveShift(split.octaveShift + delta)
    setSplit(engine.splitZoneState())
  }

  const handleTransposeChange = (delta: number) => {
    engine.setLowerTranspose(split.transpose + delta)
    setSplit(engine.splitZoneState())
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setLowerToneVolume(val)
    setSplit(engine.splitZoneState())
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setLowerTonePan(val)
    setSplit(engine.splitZoneState())
  }

  const handleReleaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setLowerToneRelease(val)
    setSplit(engine.splitZoneState())
  }

  const handleResetKeyboardSplit = () => {
    engine.setSplitEnabled(false)
    engine.setSplitPoint(60)
    engine.setLowerOctaveShift(-1)
    engine.setLowerTranspose(0)
    engine.setLowerTuningCents(0)
    engine.setLowerToneVolume(1)
    engine.setLowerTonePan(0)
    engine.setLowerToneRelease(0.3)
    engine.setLowerToneCutoff(1)
    engine.setLowerToneReverbAmount(0)
    engine.setLowerToneReverbPreset('room')
    engine.setLowerToneChorusAmount(0)
    engine.setLowerToneDelayAmount(0)
    engine.setLowerToneDelayTime(0.35)
    engine.setLowerToneDelayFeedback(0.3)
    void engine.setLowerInstrument('synth-bass')
    setSplit(engine.splitZoneState())
  }

  return (
    <Card
      className={`dt mt border-border transition-all ${split.enabled ? 'mt--dual-active' : 'opacity-90'}`}
      data-testid="split-panel"
      aria-label="Keyboard split controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">KEYBOARD SPLIT (ZONE)</span>
          <Badge
            variant={split.enabled ? 'accent' : 'outline'}
            className={`mt-badge ${split.enabled ? '' : 'mt-badge--subtle'} text-[10px]`}
          >
            {split.enabled ? 'Split Active' : 'Off'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={split.enabled ? 'on' : 'outline'}
            size="sm"
            className={`btn ${split.enabled ? 'btn--on' : ''}`}
            data-testid="split-toggle-btn"
            onClick={() => {
              engine.setSplitEnabled(!split.enabled)
              setSplit(engine.splitZoneState())
            }}
          >
            Split {split.enabled ? 'ON' : 'OFF'}
          </Button>
          {split.enabled && (
            <Select
              value={split.instrument}
              onChange={handleInstrumentChange}
              className="chip select w-40 text-xs"
              data-testid="lower-instrument-select"
            >
              {(instruments.length > 0 ? instruments : engine.getInstruments()).map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </CardHeader>

      {split.enabled && (
        <CardContent className="p-3 pt-0">
          <div className="mt-grid flex gap-3 flex-wrap">
            {/* Sub-Card 1: Lower Zone Sound & Split Point */}
            <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span>Lower Zone Controls</span>
                  <ResetButton
                    onReset={handleResetKeyboardSplit}
                    title="Reset Keyboard Split to Default"
                    ariaLabel="Reset Keyboard Split to Default"
                    dataTestId="reset-keyboard-split"
                  />
                </div>
                <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px] font-mono tabular-nums">
                  {getNoteName(split.splitPoint)}
                </Badge>
              </div>

              <div className="mt__row flex flex-wrap gap-2.5 items-center">
                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground flex-1 min-w-[140px]">
                  <span>Split Point Key</span>
                  <input
                    type="range"
                    min="36"
                    max="96"
                    value={split.splitPoint}
                    onChange={handleSplitPoint}
                    className="mt__slider w-full accent-primary cursor-pointer"
                    data-testid="split-point-slider"
                  />
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Lower Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={split.volume}
                    onChange={handleVolumeChange}
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    data-testid="lower-volume-slider"
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums">
                    {Math.round(split.volume * 100)}%
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Lower Pan</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={split.pan}
                    onChange={handlePanChange}
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    data-testid="lower-pan-slider"
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums">
                    {split.pan === 0 ? 'Center' : split.pan < 0 ? `L${Math.round(-split.pan * 100)}` : `R${Math.round(split.pan * 100)}`}
                  </span>
                </label>

                <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Lower Release</span>
                  <input
                    type="range"
                    min="0.01"
                    max="4"
                    step="0.01"
                    value={split.tone?.releaseTime ?? 0.3}
                    onChange={handleReleaseChange}
                    className="mt__slider w-28 accent-primary cursor-pointer"
                    data-testid="lower-release-slider"
                  />
                  <span className="mt__out font-mono text-[11px] text-foreground tabular-nums">
                    {(split.tone?.releaseTime ?? 0.3).toFixed(2)}s
                  </span>
                </label>
              </div>
            </div>

            {/* Sub-Card 2: Lower Zone Tuning & Pitch */}
            <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
              <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Lower Tuning Shift</span>
                <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                  Pitch Shift
                </Badge>
              </div>

              <div className="mt__row flex flex-wrap gap-2.5 items-center">
                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Lower Octave</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-2 text-xs"
                      onClick={() => handleOctaveChange(-1)}
                      data-testid="lower-octave-down"
                    >
                      −
                    </Button>
                    <Badge variant="secondary" className="font-mono text-[10px] min-w-[2.5rem] inline-flex justify-center text-center tabular-nums">
                      {split.octaveShift}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-2 text-xs"
                      onClick={() => handleOctaveChange(1)}
                      data-testid="lower-octave-up"
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span>Lower Transpose</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-2 text-xs"
                      onClick={() => handleTransposeChange(-1)}
                      data-testid="lower-transpose-down"
                    >
                      −
                    </Button>
                    <Badge variant="secondary" className="font-mono text-[10px] min-w-[2.5rem] inline-flex justify-center text-center tabular-nums">
                      {split.transpose}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn h-6 px-2 text-xs"
                      onClick={() => handleTransposeChange(1)}
                      data-testid="lower-transpose-up"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
