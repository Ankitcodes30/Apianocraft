import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { SplitZoneSnapshot } from '../audio/types'

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
    <div className={`panel split-panel ${split.enabled ? 'active' : ''}`} data-testid="split-panel">
      <div className="panel-header">
        <h3 className="panel-title">Split Keyboard</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={split.enabled}
            onChange={handleToggle}
            data-testid="split-toggle"
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {split.enabled && (
        <div className="panel-content">
          <div className="control-group">
            <label className="control-label">
              Split Point: {getNoteName(split.splitPoint)}
            </label>
            <input
              type="range"
              min="36"
              max="96"
              value={split.splitPoint}
              onChange={handleSplitPoint}
              className="control-slider"
              data-testid="split-point-slider"
            />
          </div>

          <div className="control-group">
            <label className="control-label">Lower Instrument</label>
            <select
              value={split.instrument}
              onChange={handleInstrumentChange}
              className="control-select"
              data-testid="lower-instrument-select"
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-row">
            <div className="control-group half">
              <label className="control-label">Octave: {split.octaveShift}</label>
              <div className="btn-group">
                <button
                  className="btn-octave"
                  onClick={() => handleOctaveChange(-1)}
                  data-testid="lower-octave-down"
                >
                  -
                </button>
                <button
                  className="btn-octave"
                  onClick={() => handleOctaveChange(1)}
                  data-testid="lower-octave-up"
                >
                  +
                </button>
              </div>
            </div>

            <div className="control-group half">
              <label className="control-label">Transpose: {split.transpose}</label>
              <div className="btn-group">
                <button
                  className="btn-octave"
                  onClick={() => handleTransposeChange(-1)}
                  data-testid="lower-transpose-down"
                >
                  -
                </button>
                <button
                  className="btn-octave"
                  onClick={() => handleTransposeChange(1)}
                  data-testid="lower-transpose-up"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Lower Volume: {Math.round(split.volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={split.volume}
              onChange={handleVolumeChange}
              className="control-slider"
              data-testid="lower-volume-slider"
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              Lower Pan: {split.pan === 0 ? 'Center' : split.pan < 0 ? `L${Math.round(-split.pan * 100)}` : `R${Math.round(split.pan * 100)}`}
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={split.pan}
              onChange={handlePanChange}
              className="control-slider"
              data-testid="lower-pan-slider"
            />
          </div>
        </div>
      )}
    </div>
  )
}
