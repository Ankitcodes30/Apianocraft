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
    <Card className="tools-panel border-[#3A3A3A] bg-[#242424]" aria-label="Workstation Tools Panel">
      <CardHeader className="tools-panel__head p-2.5 pb-2">
        <span className="tools-panel__title font-semibold text-xs text-[#F2F2F2]">
          WORKSTATION TOOLS & HARMONY
        </span>
      </CardHeader>

      <CardContent className="p-2.5 pt-0 flex flex-col gap-2.5">
        {/* Metronome Controls */}
        <div className="tools-section metronome-section p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-2">
          <div className="metronome-section__header flex items-center justify-between">
            <span className="section-label font-medium text-[10px] text-[#B5B5B5] uppercase">
              METRONOME CLOCK
            </span>
            <div className="metronome-tempo-display font-mono text-xs text-[#F2F2F2] flex items-center gap-1">
              <span className="bpm-val font-semibold text-[#5B7FA3] text-sm" data-bpm-val>{metronomeSnap.bpm}</span>
              <span className="bpm-unit text-[#808080] text-[9px]">BPM</span>
            </div>
          </div>

          <div className="metronome-section__controls flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant={metronomeSnap.running ? 'on' : 'outline'}
              size="sm"
              className={`btn-metronome ${metronomeSnap.running ? 'bg-[#5B7FA3] border-[#5B7FA3] text-white font-semibold' : 'bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]'}`}
              onClick={handleMetronomeToggle}
              data-btn-metronome
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${metronomeSnap.running ? 'bg-[#6FA77A]' : 'bg-[#808080]'}`} />
              {metronomeSnap.running ? 'Stop Metronome' : 'Start Metronome'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="btn-tap-tempo text-xs bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
              onClick={handleTapTempo}
              data-btn-tap-tempo
            >
              Tap Tempo
            </Button>

            <div className="tool-field flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
              <label htmlFor="time-sig-select" className="font-medium text-[9px]">Time Sig</label>
              <Select
                id="time-sig-select"
                className="select w-20 text-xs bg-[#202020] border-[#3A3A3A] text-[#F2F2F2]"
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

            <div className="tool-field slider-field flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
              <label htmlFor="bpm-slider" className="font-medium text-[9px]">BPM</label>
              <input
                id="bpm-slider"
                type="range"
                min="30"
                max="280"
                value={metronomeSnap.bpm}
                onChange={(e) => handleBpmChange(Number(e.target.value))}
                className="accent-[#5B7FA3] cursor-pointer w-24"
                data-bpm-slider
              />
            </div>

            <div className="tool-field slider-field flex flex-col gap-0.5 text-[10px] text-[#B5B5B5]">
              <label htmlFor="metronome-vol" className="font-medium text-[9px]">Vol</label>
              <input
                id="metronome-vol"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metronomeSnap.volume}
                onChange={(e) => engine.setMetronomeVolume(Number(e.target.value))}
                className="accent-[#5B7FA3] cursor-pointer w-20"
              />
            </div>
          </div>
        </div>

        {/* Real-time Chord Detector */}
        <div className="tools-section harmony-section p-2 bg-[#292929] rounded-[4px] border border-[#3A3A3A] flex flex-col gap-1.5">
          <div className="harmony-section__header flex items-center justify-between">
            <span className="section-label font-medium text-[10px] text-[#B5B5B5] uppercase">
              REAL-TIME CHORD HARMONY DETECTOR
            </span>
          </div>

          <div className="chord-display-container flex items-center justify-center p-2 bg-[#202020] rounded-[4px] border border-[#3A3A3A]">
            <Badge variant="accent" className="chord-badge text-xs font-mono font-semibold px-3 py-1 bg-[#29323C] text-[#F2F2F2] border-[#4A5D70]" data-chord-name>
              {chord ? chord.name : '— No Active Chord —'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
