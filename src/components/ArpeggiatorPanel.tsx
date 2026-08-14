import { useState } from 'react'
import type { Arpeggiator, ArpDirection, ArpRate } from '../performance/Arpeggiator'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export function ArpeggiatorPanel({ arp }: { arp: Arpeggiator }) {
  const [enabled, setEnabled] = useState(() => arp.isEnabled)
  const [rate, setRate] = useState<ArpRate>(() => arp.currentRate)
  const [direction, setDirection] = useState<ArpDirection>(() => arp.currentDirection)
  const [octave, setOctave] = useState(() => arp.currentOctaveRange)
  const [gate, setGate] = useState(() => arp.currentGate)

  const toggleArp = () => {
    const next = !enabled
    arp.setEnabled(next)
    setEnabled(next)
  }

  return (
    <Card
      className={`mt border-border transition-all ${enabled ? 'mt--dual-active' : ''}`}
      aria-label="Arpeggiator controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">ARPEGGIATOR</span>
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
          data-arp-toggle
          onClick={toggleArp}
        >
          Arp {enabled ? 'ON' : 'OFF'}
        </Button>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="mt-grid flex gap-3 flex-wrap">
          <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Pattern & Timing</span>
              <Badge variant="outline" className="mt-badge mt-badge--subtle text-[10px]">
                {rate}
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2.5 items-center">
              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Rate</span>
                <Select
                  className="chip select w-32 text-xs"
                  aria-label="Arpeggiator Rate"
                  data-arp-rate
                  value={rate}
                  onChange={(e) => {
                    const r = e.target.value as ArpRate
                    arp.setRate(r)
                    setRate(r)
                  }}
                >
                  <option value="1/1">1/1 (Whole)</option>
                  <option value="1/2">1/2 (Half)</option>
                  <option value="1/4">1/4 (Quarter)</option>
                  <option value="1/8">1/8 (Eighth)</option>
                  <option value="1/16">1/16 (Sixteenth)</option>
                </Select>
              </label>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Direction</span>
                <Select
                  className="chip select w-32 text-xs"
                  aria-label="Arpeggiator Direction"
                  data-arp-direction
                  value={direction}
                  onChange={(e) => {
                    const d = e.target.value as ArpDirection
                    arp.setDirection(d)
                    setDirection(d)
                  }}
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="up-down">Up / Down</option>
                  <option value="random">Random</option>
                </Select>
              </label>

              <div className="mt__ctl mt__stepper flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Octaves</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 px-2 text-xs"
                    data-arp-octave-down
                    onClick={() => {
                      const next = Math.max(1, octave - 1)
                      arp.setOctaveRange(next)
                      setOctave(next)
                    }}
                  >
                    −
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-6 px-2 text-xs"
                    data-arp-octave-up
                    onClick={() => {
                      const next = Math.min(4, octave + 1)
                      arp.setOctaveRange(next)
                      setOctave(next)
                    }}
                  >
                    +
                  </Button>
                  <Badge variant="secondary" className="chip font-mono" data-arp-octave-val>
                    {octave} Oct
                  </Badge>
                </div>
              </div>

              <label className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Gate ({Math.round(gate * 100)}%)</span>
                <input
                  type="range"
                  className="mt__slider w-28 accent-primary cursor-pointer"
                  aria-label="Arpeggiator Gate"
                  data-arp-gate
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={gate}
                  onChange={(e) => {
                    const g = parseFloat(e.target.value)
                    arp.setGate(g)
                    setGate(g)
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
