import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { SplitZoneSnapshot } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    engine.setSplitEnabled(e.target.checked)
    setSplit(engine.splitZoneState())
  }

  const handleSplitPoint = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    engine.setSplitPoint(val)
    setSplit(engine.splitZoneState())
  }

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void engine.setLowerInstrument(e.target.value)
    setSplit(engine.splitZoneState())
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

  return (
    <Card
      className={`panel split-panel border-border transition-all ${split.enabled ? 'active' : 'opacity-90'}`}
      data-testid="split-panel"
    >
      <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 p-3">
        <div className="flex items-center gap-2">
          <h3 className="panel-title font-bold text-xs tracking-wider text-foreground">KEYBOARD SPLIT</h3>
          <Badge variant={split.enabled ? 'accent' : 'outline'} className="text-[10px]">
            {split.enabled ? 'Split Active' : 'Off'}
          </Badge>
        </div>
        <label className="toggle-switch inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={split.enabled}
            onChange={handleToggle}
            data-testid="split-toggle"
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary relative" />
          <span className="text-xs font-semibold text-muted-foreground">
            {split.enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        {!split.enabled ? (
          <div className="flex flex-col items-center justify-center py-4 px-3 bg-secondary/10 rounded border border-dashed border-border/60 text-center gap-2">
            <span className="text-xl opacity-60">🎹</span>
            <div className="text-xs text-muted-foreground font-medium">
              Split the 88 keys into two independent zones (Lower & Upper) with separate instruments
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                engine.setSplitEnabled(true)
                setSplit(engine.splitZoneState())
              }}
              className="mt-1 text-xs"
            >
              + Enable Keyboard Split
            </Button>
          </div>
        ) : (
          <div className="panel-content flex flex-col gap-3">
            <div className="control-group flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label className="control-label flex justify-between">
                <span>Split Point</span>
                <span className="font-mono text-foreground">{getNoteName(split.splitPoint)}</span>
              </label>
              <input
                type="range"
                min="36"
                max="96"
                value={split.splitPoint}
                onChange={handleSplitPoint}
                className="control-slider accent-primary cursor-pointer w-full"
                data-testid="split-point-slider"
              />
            </div>

            <div className="control-group flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label className="control-label font-semibold">Lower Zone Instrument</label>
              <Select
                value={split.instrument}
                onChange={handleInstrumentChange}
                className="control-select text-xs cursor-pointer relative z-10"
                data-testid="lower-instrument-select"
              >
                {(instruments.length > 0 ? instruments : engine.getInstruments()).map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="control-row flex gap-3 flex-wrap items-center">
              <div className="control-group half flex flex-col gap-1 text-[11px] text-muted-foreground">
                <label className="control-label flex justify-between">
                  <span>Lower Octave</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{split.octaveShift}</Badge>
                </label>
                <div className="btn-group flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-6 px-2 text-xs"
                    onClick={() => handleOctaveChange(-1)}
                    data-testid="lower-octave-down"
                  >
                    −
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-6 px-2 text-xs"
                    onClick={() => handleOctaveChange(1)}
                    data-testid="lower-octave-up"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="control-group half flex flex-col gap-1 text-[11px] text-muted-foreground">
                <label className="control-label flex justify-between">
                  <span>Lower Transpose</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{split.transpose}</Badge>
                </label>
                <div className="btn-group flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-6 px-2 text-xs"
                    onClick={() => handleTransposeChange(-1)}
                    data-testid="lower-transpose-down"
                  >
                    −
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-6 px-2 text-xs"
                    onClick={() => handleTransposeChange(1)}
                    data-testid="lower-transpose-up"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="control-group flex flex-col gap-1 text-[11px] text-muted-foreground">
                <label className="control-label flex justify-between">
                  <span>Lower Volume</span>
                  <span className="font-mono text-foreground">{Math.round(split.volume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={split.volume}
                  onChange={handleVolumeChange}
                  className="control-slider accent-primary cursor-pointer w-28"
                  data-testid="lower-volume-slider"
                />
              </div>

              <div className="control-group flex flex-col gap-1 text-[11px] text-muted-foreground">
                <label className="control-label flex justify-between">
                  <span>Lower Pan</span>
                  <span className="font-mono text-foreground">
                    {split.pan === 0 ? 'Center' : split.pan < 0 ? `L${Math.round(-split.pan * 100)}` : `R${Math.round(split.pan * 100)}`}
                  </span>
                </label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={split.pan}
                  onChange={handlePanChange}
                  className="control-slider accent-primary cursor-pointer w-28"
                  data-testid="lower-pan-slider"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
