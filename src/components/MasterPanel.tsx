import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { MasterEQState } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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
    <Card className="panel master-panel border-[#3A3A3A] bg-[#242424]" data-testid="master-panel">
      <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="panel-title font-semibold text-xs text-[#F2F2F2]">MASTER BUS & EQ</h3>
          <Badge variant="outline" className="font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
            Peak: {peak.toFixed(2)}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="panel-btn-small h-5 px-2 text-[10px] bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
          onClick={resetEq}
          title="Reset EQ to 0 dB"
        >
          Reset EQ
        </Button>
      </CardHeader>

      <CardContent className="p-2.5 pt-0 flex flex-col gap-2.5">
        <div className="control-group flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
          <div className="flex justify-between items-center">
            <span className="font-medium text-[9px]">Master Volume</span>
            <span className="font-mono text-xs text-[#F2F2F2] font-semibold">{Math.round(eq.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={eq.volume}
            onChange={handleVolumeChange}
            className="control-slider accent-[#5B7FA3] cursor-pointer w-full"
            data-testid="master-volume-slider"
          />
        </div>

        <div className="eq-grid flex gap-2 flex-wrap">
          <div className="eq-control flex-1 min-w-[85px] flex flex-col gap-1 text-[10px] text-[#B5B5B5] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A]">
            <span className="eq-label font-medium text-[9px] text-[#B5B5B5]">Low (100Hz)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.lowGainDb}
              onChange={handleLowChange}
              className="control-slider accent-[#5B7FA3] cursor-pointer w-full"
              data-testid="master-eq-low"
            />
            <span className="eq-value font-mono text-xs text-[#F2F2F2] font-semibold text-center">
              {eq.lowGainDb > 0 ? `+${eq.lowGainDb}` : eq.lowGainDb} dB
            </span>
          </div>

          <div className="eq-control flex-1 min-w-[85px] flex flex-col gap-1 text-[10px] text-[#B5B5B5] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A]">
            <span className="eq-label font-medium text-[9px] text-[#B5B5B5]">Mid (1kHz)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.midGainDb}
              onChange={handleMidChange}
              className="control-slider accent-[#5B7FA3] cursor-pointer w-full"
              data-testid="master-eq-mid"
            />
            <span className="eq-value font-mono text-xs text-[#F2F2F2] font-semibold text-center">
              {eq.midGainDb > 0 ? `+${eq.midGainDb}` : eq.midGainDb} dB
            </span>
          </div>

          <div className="eq-control flex-1 min-w-[85px] flex flex-col gap-1 text-[10px] text-[#B5B5B5] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A]">
            <span className="eq-label font-medium text-[9px] text-[#B5B5B5]">High (8kHz)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eq.highGainDb}
              onChange={handleHighChange}
              className="control-slider accent-[#5B7FA3] cursor-pointer w-full"
              data-testid="master-eq-high"
            />
            <span className="eq-value font-mono text-xs text-[#F2F2F2] font-semibold text-center">
              {eq.highGainDb > 0 ? `+${eq.highGainDb}` : eq.highGainDb} dB
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
