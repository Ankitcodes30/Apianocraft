import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { TransportSnapshot } from '../audio/recorder/PerformanceRecorder'

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

export const RecorderPanel: React.FC = () => {
  const engine = getEngine()
  const [snap, setSnap] = useState<TransportSnapshot>(() => engine.getRecorderSnapshot())

  useEffect(() => {
    const unsub = engine.subscribeRecorder((s) => setSnap(s))
    const timer = setInterval(() => {
      if (snap.state === 'recording' || snap.state === 'playing') {
        setSnap(engine.getRecorderSnapshot())
      }
    }, 50)
    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [engine, snap.state])

  const handleRecordToggle = () => {
    if (snap.state === 'recording') {
      engine.stopRecording()
    } else {
      engine.startRecording()
    }
  }

  const handlePlayToggle = () => {
    if (snap.state === 'playing') {
      engine.stopPlayback()
    } else {
      engine.startPlayback()
    }
  }

  const handleStop = () => {
    engine.stopRecording()
    engine.stopPlayback()
  }

  const handleClear = () => {
    engine.clearRecording()
  }

  const handleExportMidi = () => {
    const midiBytes = engine.exportMidi()
    if (midiBytes.length === 0) return
    const blob = new Blob([Uint8Array.from(midiBytes)], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apianocraft-session-${Date.now()}.mid`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportWav = () => {
    const wavBytes = engine.exportWav()
    if (wavBytes.length === 0) return
    const blob = new Blob([Uint8Array.from(wavBytes)], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apianocraft-audio-${Date.now()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="recorder-panel" aria-label="Performance Recorder Controls">
      <div className="recorder-panel__head">
        <span className="recorder-panel__title">RECORDER / TRANSPORT</span>
        <div className="recorder-panel__timecode" data-timecode>
          {formatTimecode(snap.recordedTimeMs)}
        </div>
      </div>

      <div className="recorder-panel__controls">
        <button
          type="button"
          className={`btn-transport btn-record ${snap.state === 'recording' ? 'active' : ''}`}
          onClick={handleRecordToggle}
          aria-label={snap.state === 'recording' ? 'Stop Recording' : 'Record'}
          data-btn-record
        >
          <span className="rec-dot" />
          {snap.state === 'recording' ? 'Rec...' : 'Record'}
        </button>

        <button
          type="button"
          className={`btn-transport btn-play ${snap.state === 'playing' ? 'active' : ''}`}
          onClick={handlePlayToggle}
          disabled={snap.eventCount === 0 || snap.state === 'recording'}
          aria-label={snap.state === 'playing' ? 'Pause Playback' : 'Play'}
          data-btn-play
        >
          ▶ {snap.state === 'playing' ? 'Playing' : 'Play'}
        </button>

        <button
          type="button"
          className="btn-transport btn-stop"
          onClick={handleStop}
          disabled={snap.state === 'idle'}
          aria-label="Stop Transport"
          data-btn-stop
        >
          ■ Stop
        </button>

        <button
          type="button"
          className="btn-transport btn-clear"
          onClick={handleClear}
          disabled={snap.eventCount === 0}
          aria-label="Clear Recorded Events"
          data-btn-clear
        >
          Clear ({snap.eventCount})
        </button>
      </div>

      <div className="recorder-panel__export">
        <button
          type="button"
          className="btn-export btn-export-midi"
          onClick={handleExportMidi}
          disabled={snap.eventCount === 0}
          data-export-midi
        >
          Export MIDI (.mid)
        </button>

        <button
          type="button"
          className="btn-export btn-export-wav"
          onClick={handleExportWav}
          disabled={snap.eventCount === 0}
          data-export-wav
        >
          Export Audio (.wav)
        </button>
      </div>
    </section>
  )
}
