import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { MasterEQState } from '../audio/types'

export const MasterPanel: React.FC = () => {
  const engine = getEngine()
  const [eq, setEq] = useState<MasterEQState>(engine.masterEQState())
  const [peak, setPeak] = useState<number>(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setEq(engine.masterEQState())
      const level = engine.limiterLevel()
      setPeak(level.peak)
    }, 100)
    return () => clearInterval(timer)
  }, [engine])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setMasterVolume(val)
    setEq(engine.masterEQState())
  }

  const handleLowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setMasterEqLow(val)
    setEq(engine.masterEQState())
  }

  const handleMidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setMasterEqMid(val)
    setEq(engine.masterEQState())
  }

  const handleHighChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    engine.setMasterEqHigh(val)
    setEq(engine.masterEQState())
  }

  const resetEq = () => {
    engine.setMasterEqLow(0)
    engine.setMasterEqMid(0)
    engine.setMasterEqHigh(0)
    setEq(engine.masterEQState())
  }

  return (
    <div className="panel master-panel" data-testid="master-panel">
      <div className="panel-header">
        <h3 className="panel-title">Master Bus & EQ</h3>
        <button className="panel-btn-small" onClick={resetEq} title="Reset EQ to 0 dB">
          Reset EQ
        </button>
      </div>

      <div className="control-group">
        <label className="control-label">
          Master Volume: {Math.round(eq.volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={eq.volume}
          onChange={handleVolumeChange}
          className="control-slider"
          data-testid="master-volume-slider"
        />
      </div>

      <div className="eq-grid">
        <div className="eq-control">
          <span className="eq-label">Low (100Hz)</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={eq.lowGainDb}
            onChange={handleLowChange}
            className="control-slider"
            data-testid="master-eq-low"
          />
          <span className="eq-value">{eq.lowGainDb > 0 ? `+${eq.lowGainDb}` : eq.lowGainDb} dB</span>
        </div>

        <div className="eq-control">
          <span className="eq-label">Mid (1kHz)</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={eq.midGainDb}
            onChange={handleMidChange}
            className="control-slider"
            data-testid="master-eq-mid"
          />
          <span className="eq-value">{eq.midGainDb > 0 ? `+${eq.midGainDb}` : eq.midGainDb} dB</span>
        </div>

        <div className="eq-control">
          <span className="eq-label">High (8kHz)</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={eq.highGainDb}
            onChange={handleHighChange}
            className="control-slider"
            data-testid="master-eq-high"
          />
          <span className="eq-value">{eq.highGainDb > 0 ? `+${eq.highGainDb}` : eq.highGainDb} dB</span>
        </div>
      </div>

      <div className="meter-container">
        <span className="meter-label">Limiter Peak</span>
        <div className="meter-bar-outer">
          <div
            className={`meter-bar-inner ${peak > 0.9 ? 'peak-clip' : ''}`}
            style={{ width: `${Math.min(100, Math.round(peak * 100))}%` }}
          />
        </div>
        <span className="meter-value">{(peak * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}
