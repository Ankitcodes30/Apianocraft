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
      className={`panel split-panel border-[#3A3A3A] bg-[#242424] transition-all ${split.enabled ? 'border-[#5B7FA3]' : ''}`}
      data-testid="split-panel"
    >
      <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="panel-title font-semibold text-xs text-[#F2F2F2]">KEYBOARD SPLIT (DUAL ZONES)</h3>
          <Badge variant={split.enabled ? 'accent' : 'outline'} className={`font-mono text-[9px] ${split.enabled ? 'bg-[#29323C] text-[#F2F2F2] border-[#4A5D70]' : 'text-[#B5B5B5] border-[#3A3A3A]'}`}>
            {split.enabled ? 'SPLIT ACTIVE' : 'OFF'}
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
          <div className="w-7 h-4 bg-[#3A3A3A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#A0A0A0] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#5B7FA3] peer-checked:after:bg-white relative" />
          <span className="text-xs font-semibold text-[#B5B5B5] font-mono">
            {split.enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        {!split.enabled ? (
          <div className="flex flex-row items-center justify-between py-2 px-3 bg-[#292929] rounded-[4px] border border-[#3A3A3A] text-xs gap-3">
            <span className="text-[#B5B5B5] font-medium text-[11px]">
              Divide 88 keys into Lower & Upper performance zones.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                engine.setSplitEnabled(true)
                setSplit(engine.splitZoneState())
              }}
              className="text-xs font-semibold bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5] hover:bg-[#353535]"
            >
              + Enable Split
            </Button>
          </div>
        ) : (
          <div className="panel-content flex flex-col gap-2">
            {/* Visual Zone Indicator */}
            <div className="flex items-center justify-between p-1.5 bg-[#292929] rounded-[4px] border border-[#3A3A3A] text-[10px] font-mono">
              <span className="text-[#5B7FA3] font-semibold">LOWER ZONE: C2 ↔ {getNoteName(split.splitPoint - 1)}</span>
              <span className="text-[#808080]">SPLIT: {getNoteName(split.splitPoint)}</span>
              <span className="text-[#6FA77A] font-semibold">UPPER ZONE: {getNoteName(split.splitPoint)} ↔ C7</span>
            </div>

            <div className="control-group flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
              <div className="flex justify-between items-center">
                <span className="font-medium text-[9px]">Split Point</span>
                <span className="font-mono text-xs text-[#F2F2F2] font-semibold">{getNoteName(split.splitPoint)}</span>
              </div>
              <input
                type="range"
                min="36"
                max="96"
                value={split.splitPoint}
                onChange={handleSplitPoint}
                className="control-slider accent-[#5B7FA3] cursor-pointer w-full"
                data-testid="split-point-slider"
              />
            </div>

            <div className="control-group flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
              <span className="control-label font-medium text-[9px]">Lower Zone Instrument</span>
              <Select
                value={split.instrument}
                onChange={handleInstrumentChange}
                className="control-select text-xs cursor-pointer relative z-10 bg-[#292929] border-[#3A3A3A] text-[#F2F2F2]"
                data-testid="lower-instrument-select"
              >
                {(instruments.length > 0 ? instruments : engine.getInstruments()).map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="control-row flex gap-2 flex-wrap items-center">
              <div className="control-group half flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[9px]">Lower Octave</span>
                  <Badge variant="secondary" className="font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]">{split.octaveShift}</Badge>
                </div>
                <div className="btn-group flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    onClick={() => handleOctaveChange(-1)}
                    data-testid="lower-octave-down"
                  >
                    −
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    onClick={() => handleOctaveChange(1)}
                    data-testid="lower-octave-up"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="control-group half flex flex-col gap-1 text-[10px] text-[#B5B5B5]">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[9px]">Lower Transpose</span>
                  <Badge variant="secondary" className="font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]">{split.transpose}</Badge>
                </div>
                <div className="btn-group flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    onClick={() => handleTransposeChange(-1)}
                    data-testid="lower-transpose-down"
                  >
                    −
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-octave h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    onClick={() => handleTransposeChange(1)}
                    data-testid="lower-transpose-up"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="control-group flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[9px]">Lower Volume</span>
                  <span className="font-mono text-xs text-[#F2F2F2] font-semibold">{Math.round(split.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={split.volume}
                  onChange={handleVolumeChange}
                  className="control-slider accent-[#5B7FA3] cursor-pointer w-28"
                  data-testid="lower-volume-slider"
                />
              </div>

              <div className="control-group flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[9px]">Lower Pan</span>
                  <span className="font-mono text-xs text-[#F2F2F2] font-semibold">
                    {split.pan === 0 ? 'Center' : split.pan < 0 ? `L${Math.round(-split.pan * 100)}` : `R${Math.round(split.pan * 100)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={split.pan}
                  onChange={handlePanChange}
                  className="control-slider accent-[#5B7FA3] cursor-pointer w-28"
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
