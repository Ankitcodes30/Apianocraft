import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { MetronomeSnapshot, TimeSignature } from '../audio/tools/Metronome'
import { detectChord, type ChordResult } from '../audio/tools/ChordDetector'
import { ROOT_KEYS, SCALE_DEFINITIONS, getScaleHighlightState, type ScaleType } from '../audio/tools/ScaleProvider'

interface WorkstationToolsPanelProps {
  onScaleChange?: (rootKey: string, scaleType: ScaleType) => void
}

export const WorkstationToolsPanel: React.FC<WorkstationToolsPanelProps> = ({ onScaleChange }) => {
  const engine = getEngine()
  const [metronomeSnap, setMetronomeSnap] = useState<MetronomeSnapshot>(() => engine.getMetronomeSnapshot())
  const [chord, setChord] = useState<ChordResult | null>(null)
  const [selectedRoot, setSelectedRoot] = useState<string>('C')
  const [selectedScale, setSelectedScale] = useState<ScaleType>('none')

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

  const handleRootChange = (r: string) => {
    setSelectedRoot(r)
    onScaleChange?.(r, selectedScale)
    updateKeyboardScaleHighlights(r, selectedScale)
  }

  const handleScaleChange = (st: ScaleType) => {
    setSelectedScale(st)
    onScaleChange?.(selectedRoot, st)
    updateKeyboardScaleHighlights(selectedRoot, st)
  }

  const updateKeyboardScaleHighlights = (rootKey: string, scaleType: ScaleType) => {
    const state = getScaleHighlightState(rootKey, scaleType)
    const keys = document.querySelectorAll<HTMLElement>('[data-note]')
    keys.forEach((el) => {
      const note = parseInt(el.getAttribute('data-note') || '-1', 10)
      if (note < 0) return
      const pc = note % 12
      el.removeAttribute('data-scale-highlight')
      if (state.scaleType !== 'none' && state.scalePitchClasses.has(pc)) {
        if (pc === state.rootPitchClass) {
          el.setAttribute('data-scale-highlight', 'root')
        } else {
          el.setAttribute('data-scale-highlight', 'degree')
        }
      }
    })
  }

  return (
    <section className="tools-panel" aria-label="Workstation Tools Panel">
      <div className="tools-panel__head">
        <span className="tools-panel__title">WORKSTATION TOOLS & HARMONY</span>
      </div>

      <div className="tools-panel__body">
        {/* Metronome Controls */}
        <div className="tools-section metronome-section">
          <div className="metronome-section__header">
            <span className="section-label">METRONOME</span>
            <div className="metronome-tempo-display">
              <span className="bpm-val" data-bpm-val>{metronomeSnap.bpm}</span>
              <span className="bpm-unit">BPM</span>
            </div>
          </div>

          <div className="metronome-section__controls">
            <button
              type="button"
              className={`btn-metronome ${metronomeSnap.running ? 'active' : ''}`}
              onClick={handleMetronomeToggle}
              data-btn-metronome
            >
              {metronomeSnap.running ? 'Stop Metronome' : 'Start Metronome'}
            </button>

            <button
              type="button"
              className="btn-tap-tempo"
              onClick={handleTapTempo}
              data-btn-tap-tempo
            >
              Tap Tempo
            </button>

            <div className="tool-field">
              <label htmlFor="time-sig-select">Time Sig</label>
              <select
                id="time-sig-select"
                className="select"
                value={metronomeSnap.timeSignature}
                onChange={(e) => handleTimeSigChange(e.target.value as TimeSignature)}
                data-time-signature
              >
                <option value="2/4">2/4</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>

            <div className="tool-field slider-field">
              <label htmlFor="bpm-slider">BPM</label>
              <input
                id="bpm-slider"
                type="range"
                min="30"
                max="280"
                value={metronomeSnap.bpm}
                onChange={(e) => handleBpmChange(Number(e.target.value))}
                data-bpm-slider
              />
            </div>

            <div className="tool-field slider-field">
              <label htmlFor="metronome-vol">Vol</label>
              <input
                id="metronome-vol"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metronomeSnap.volume}
                onChange={(e) => engine.setMetronomeVolume(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Chord & Scale Guide */}
        <div className="tools-section harmony-section">
          <div className="harmony-section__header">
            <span className="section-label">CHORD & HARMONY ASSIST</span>
          </div>

          <div className="chord-display-container">
            <div className="chord-badge" data-chord-name>
              {chord ? chord.name : '— No Active Chord —'}
            </div>
          </div>

          <div className="scale-guide-controls">
            <div className="tool-field">
              <label htmlFor="root-key-select">Root Key</label>
              <select
                id="root-key-select"
                className="select"
                value={selectedRoot}
                onChange={(e) => handleRootChange(e.target.value)}
                data-root-key
              >
                {ROOT_KEYS.map((rk) => (
                  <option key={rk} value={rk}>
                    {rk}
                  </option>
                ))}
              </select>
            </div>

            <div className="tool-field">
              <label htmlFor="scale-type-select">Scale Guide</label>
              <select
                id="scale-type-select"
                className="select"
                value={selectedScale}
                onChange={(e) => handleScaleChange(e.target.value as ScaleType)}
                data-scale-type
              >
                {SCALE_DEFINITIONS.map((sd) => (
                  <option key={sd.id} value={sd.id}>
                    {sd.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
