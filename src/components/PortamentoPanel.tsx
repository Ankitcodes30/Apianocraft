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
      className={`mt border-border transition-all ${enabled ? 'mt--dual-active' : ''}`}
      aria-label="Portamento glide controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">PORTAMENTO / GLIDE</span>
          <Badge
            variant={enabled ? 'accent' : 'outline'}
            className={`mt-badge ${enabled ? '' : 'mt-badge--subtle'}`}
          >
            {enabled ? 'Active' : 'Off'}
          </Badge>
        </div>
        <Button
          type="button"
          variant={enabled ? 'on' : 'outline'}
          size="sm"
          className={`btn ${enabled ? 'btn--on' : ''}`}
          data-portamento-toggle
          onClick={togglePortamento}
        >
          Glide {enabled ? 'ON' : 'OFF'}
        </Button>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="mt-grid flex gap-3 flex-wrap">
          <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Glide Speed</span>
              <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                {timeMs} ms
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2.5 items-center">
              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Glide Time</span>
                <Select
                  className="chip select w-40 text-xs"
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
