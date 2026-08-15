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
      className={`mt border-[#3A3A3A] bg-[#242424] transition-all ${enabled ? 'border-[#5B7FA3]' : ''}`}
      aria-label="Arpeggiator controls"
    >
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-2.5 pb-2">
        <div className="mt__title flex items-center gap-2">
          <span className="font-semibold text-xs text-[#F2F2F2]">ARPEGGIATOR</span>
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
          data-arp-toggle
          onClick={toggleArp}
        >
          Arp {enabled ? 'ON' : 'OFF'}
        </Button>
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        <div className="mt-grid flex gap-2.5 flex-wrap">
          <div className="mt-card flex-1 min-w-[290px] p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[10px] font-semibold text-[#B5B5B5] uppercase">
              <span>PATTERN & TIMING GENERATOR</span>
              <Badge variant="outline" className="mt-badge font-mono text-[9px] text-[#B5B5B5] border-[#3A3A3A]">
                {rate}
              </Badge>
            </div>

            <div className="mt__row flex flex-wrap gap-2 items-center">
              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Rate</span>
                <Select
                  className="chip select w-28 text-xs font-medium bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
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
                  <option value="1/16">1/16 (16th)</option>
                </Select>
              </label>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Direction</span>
                <Select
                  className="chip select w-28 text-xs font-medium bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
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

              <div className="mt__ctl mt__stepper flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <span className="font-medium text-[9px]">Octaves</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
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
                    className="btn h-5 px-1.5 text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
                    data-arp-octave-up
                    onClick={() => {
                      const next = Math.min(4, octave + 1)
                      arp.setOctaveRange(next)
                      setOctave(next)
                    }}
                  >
                    +
                  </Button>
                  <Badge variant="secondary" className="chip font-mono text-xs text-[#F2F2F2] bg-[#202020] border-[#3A3A3A]" data-arp-octave-val>
                    {octave} Oct
                  </Badge>
                </div>
              </div>

              <label className="mt__ctl flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[9px]">Gate</span>
                  <span className="font-mono text-xs text-[#F2F2F2] font-semibold">{Math.round(gate * 100)}%</span>
                </div>
                <input
                  type="range"
                  className="mt__slider w-28 accent-[#5B7FA3] cursor-pointer"
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
