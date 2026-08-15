import { useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export function PortamentoPanel({ engine }: { engine: AudioEngine }) {
  const [enabled, setEnabled] = useState(() => engine.portamentoEnabled)
  const [timeMs, setTimeMs] = useState(() => engine.portamentoTimeMs)

  const togglePortamento = () => {
    const next = !enabled
    engine.setPortamentoEnabled(next)
    setEnabled(next)
  }

  return (
    <Card
      className={`mt border-[#3A3A3A] bg-[#242424] transition-all ${enabled ? 'border-[#5B7FA3]' : ''}`}
      aria-label="Portamento glide controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="mt__title flex items-center gap-2">
          <span className="font-semibold text-xs text-[#F2F2F2]">PORTAMENTO / GLIDE</span>
          <Badge
            variant={enabled ? 'accent' : 'outline'}
            className={`mt-badge font-mono text-[9px] ${enabled ? 'bg-[#29323C] text-[#F2F2F2] border-[#4A5D70]' : 'text-[#B5B5B5] border-[#3A3A3A]'}`}
          >
            {enabled ? 'ACTIVE' : 'OFF'}
          </Badge>
        </div>
        <Button
          type="button"
          variant={enabled ? 'on' : 'outline'}
          size="sm"
          className={`btn ${enabled ? 'bg-[#5B7FA3] border-[#5B7FA3] text-white font-semibold' : 'bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]'}`}
          data-portamento-toggle
          onClick={togglePortamento}
        >
          Glide {enabled ? 'ON' : 'OFF'}
        </Button>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        <div className="mt-grid flex gap-2.5 flex-wrap">
          <div className="mt-card flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
              <span>GLIDE TIME & TRANSITION SPEED</span>
              <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                {timeMs} ms
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2 items-center">
              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Glide Speed</span>
                <Select
                  className="chip select w-36 text-xs font-medium bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
                  aria-label="Portamento Glide Time"
                  data-portamento-time
                  value={timeMs}
                  onChange={(e) => {
                    const t = parseInt(e.target.value, 10)
                    engine.setPortamentoTime(t)
                    setTimeMs(t)
                  }}
                >
                  <option value={0}>0 ms (Off)</option>
                  <option value={20}>20 ms (Fast)</option>
                  <option value={50}>50 ms</option>
                  <option value={100}>100 ms (Medium)</option>
                  <option value={200}>200 ms</option>
                  <option value={500}>500 ms (Slow)</option>
                  <option value={1000}>1000 ms (1s Glide)</option>
                </Select>
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
