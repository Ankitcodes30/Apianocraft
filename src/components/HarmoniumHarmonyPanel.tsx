import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export interface HarmoniumState {
  coupler: boolean
  droneNote: number | null
}

const DRONE_OPTIONS = [
  { label: 'Drone OFF', value: null },
  { label: 'Sa — C3 (Midi 48)', value: 48 },
  { label: 'Re — D3 (Midi 50)', value: 50 },
  { label: 'Ga — E3 (Midi 52)', value: 52 },
  { label: 'Ma — F3 (Midi 53)', value: 53 },
  { label: 'Pa — G3 (Midi 55)', value: 55 },
  { label: 'Dha — A3 (Midi 57)', value: 57 },
  { label: 'Ni — B3 (Midi 59)', value: 59 },
  { label: 'Sa — C4 (Midi 60)', value: 60 },
]

export function HarmoniumHarmonyPanel({ engine }: { engine: AudioEngine }) {
  const [coupler, setCoupler] = useState(() => engine.harmoniumCouplerEnabled)
  const [droneNote, setDroneNote] = useState<number | null>(() => engine.harmoniumDroneNote)
  const [activeInst, setActiveInst] = useState(() => engine.instrumentId)

  useEffect(() => {
    const unsub = engine.subscribe(() => {
      setActiveInst(engine.instrumentId)
      setCoupler(engine.harmoniumCouplerEnabled)
      setDroneNote(engine.harmoniumDroneNote)
    })
    return unsub
  }, [engine])

  const isHarmonium = activeInst.startsWith('harmonium-')

  // Contextual rendering: hide panel when non-harmonium instrument is active
  if (!isHarmonium) return null

  const handleToggleCoupler = () => {
    const next = !coupler
    engine.setHarmoniumCoupler(next)
    setCoupler(next)
  }

  const handleDroneChange = (val: string) => {
    const note = val === 'off' ? null : parseInt(val, 10)
    engine.setHarmoniumDrone(note)
    setDroneNote(note)
  }

  return (
    <Card className="mt border-border transition-all border-amber-500/40 bg-amber-500/5" aria-label="Harmonium Harmony Controls">
      <CardHeader className="mt__head flex flex-row items-center justify-between space-y-0 p-3">
        <div className="mt__title flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-foreground">HARMONIUM & INDIAN HARMONY</span>
          <Badge variant="accent" className="mt-badge bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Harmonium Mode Active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="mt-grid flex gap-3 flex-wrap">
          <div className="mt-card flex-1 min-w-[300px] p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
            <div className="mt-card__title flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Reed Harmony & Drone Stopper</span>
            </div>

            <div className="mt__row flex flex-wrap gap-3 items-center">
              {/* Octave Coupler Control */}
              <div className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Octave Coupler</span>
                <Button
                  type="button"
                  variant={coupler ? 'on' : 'outline'}
                  size="sm"
                  className={`btn h-7 text-xs ${coupler ? 'btn--on bg-amber-600 border-amber-600' : ''}`}
                  data-harmonium-coupler
                  onClick={handleToggleCoupler}
                >
                  Coupler {coupler ? 'ON (+12st)' : 'OFF'}
                </Button>
              </div>

              {/* Background Drone Stopper Note Control */}
              <div className="mt__ctl flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span>Background Drone Note</span>
                <Select
                  className="chip select w-48 text-xs h-7"
                  aria-label="Harmonium Drone Note"
                  data-harmonium-drone
                  value={droneNote === null ? 'off' : String(droneNote)}
                  onChange={(e) => handleDroneChange(e.target.value)}
                >
                  {DRONE_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value === null ? 'off' : String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
