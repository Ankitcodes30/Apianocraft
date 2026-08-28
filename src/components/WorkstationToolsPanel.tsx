import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { MetronomeSnapshot, TimeSignature } from '../audio/tools/Metronome'
import { detectChord, type ChordResult } from '../audio/tools/ChordDetector'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export const WorkstationToolsPanel: React.FC = () => {
  const engine = getEngine()
  const [metronomeSnap, setMetronomeSnap] = useState<MetronomeSnapshot>(() => engine.getMetronomeSnapshot())
  const [chord, setChord] = useState<ChordResult | null>(null)

  // Metronome subscription & live beat ticker
  useEffect(() => {
    const unsub = engine.subscribeMetronome((s) => setMetronomeSnap(s))
    return unsub
  }, [engine])

  // Active notes subscription for Chord Detector
  useEffect(() => {
    const updateChord = () => {
      const activeNotes = engine.getActiveNotes()
      setChord(detectChord(activeNotes))
    }
    updateChord()
    return engine.subscribe((e) => {
      if (e.type === 'active-notes') {
        updateChord()
      }
    })
  }, [engine])

  const handleMetronomeToggle = () => {
    if (metronomeSnap.running) {
      engine.stopMetronome()
    } else {
      engine.startMetronome()
    }
  }

  const handleBpmChange = (bpm: number) => {
    engine.setMetronomeBpm(bpm)
  }

  const handleTimeSigChange = (sig: TimeSignature) => {
    engine.setMetronomeTimeSignature(sig)
  }

  const handleTapTempo = () => {
    engine.tapTempoMetronome()
  }

  return (
    <Card className="tools-panel border-border" aria-label="Workstation Tools Panel">
      <CardHeader className="tools-panel__head p-3 pb-2">
        <span className="tools-panel__title font-bold text-xs tracking-wider text-foreground">
          WORKSTATION TOOLS & HARMONY
        </span>
      </CardHeader>

      <CardContent className="p-3 pt-0 flex flex-col gap-3">
        {/* Metronome Controls */}
        <div className="tools-section metronome-section p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
          <div className="metronome-section__header flex items-center justify-between">
            <span className="section-label font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
              METRONOME
            </span>
            <div className="metronome-tempo-display font-mono text-xs text-foreground flex items-center gap-1">
              <span className="bpm-val font-bold text-primary min-w-[2.2rem] inline-block text-right tabular-nums" data-bpm-val>{metronomeSnap.bpm}</span>
              <span className="bpm-unit text-muted-foreground text-[10px]">BPM</span>
            </div>
          </div>

          <div className="metronome-section__controls flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant={metronomeSnap.running ? 'on' : 'outline'}
              size="sm"
              className={`btn-metronome ${metronomeSnap.running ? 'active' : ''}`}
              onClick={handleMetronomeToggle}
              data-btn-metronome
            >
              {metronomeSnap.running ? 'Stop Metronome' : 'Start Metronome'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="btn-tap-tempo text-xs"
              onClick={handleTapTempo}
              data-btn-tap-tempo
            >
              Tap Tempo
            </Button>

            <div className="tool-field flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label htmlFor="time-sig-select">Time Sig</label>
              <Select
                id="time-sig-select"
                className="select w-20 text-xs"
                value={metronomeSnap.timeSignature}
                onChange={(e) => handleTimeSigChange(e.target.value as TimeSignature)}
                data-time-signature
              >
                <option value="2/4">2/4</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="6/8">6/8</option>
              </Select>
            </div>

            <div className="tool-field slider-field flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label htmlFor="bpm-slider">BPM</label>
              <input
                id="bpm-slider"
                type="range"
                min="30"
                max="280"
                value={metronomeSnap.bpm}
                onChange={(e) => handleBpmChange(Number(e.target.value))}
                className="accent-primary cursor-pointer w-28"
                data-bpm-slider
              />
            </div>

            <div className="tool-field slider-field flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label htmlFor="metronome-vol">Vol</label>
              <input
                id="metronome-vol"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metronomeSnap.volume}
                onChange={(e) => engine.setMetronomeVolume(Number(e.target.value))}
                className="accent-primary cursor-pointer w-24"
              />
            </div>
          </div>
        </div>

        {/* Real-time Chord Detector */}
        <div className="tools-section harmony-section p-2.5 bg-secondary/20 rounded border border-border flex flex-col gap-2">
          <div className="harmony-section__header flex items-center justify-between">
            <span className="section-label font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
              REAL-TIME CHORD DETECTOR
            </span>
          </div>

          <div className="chord-display-container">
            <Badge variant="accent" className="chord-badge text-xs font-mono font-bold px-3 py-1 text-primary-foreground min-w-[12rem] inline-flex items-center justify-center text-center tabular-nums" data-chord-name>
              {chord ? chord.name : '— No Active Chord —'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
