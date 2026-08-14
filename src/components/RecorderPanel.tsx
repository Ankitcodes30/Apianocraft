import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { TransportSnapshot } from '../audio/recorder/PerformanceRecorder'
import { Card, CardHeader, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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
    <Card className="recorder-panel border-border" aria-label="Performance Recorder Controls">
      <CardHeader className="recorder-panel__head flex flex-row items-center justify-between space-y-0 p-3">
        <span className="recorder-panel__title font-bold text-xs tracking-wider text-foreground">
          RECORDER / TRANSPORT
        </span>
        <Badge variant="outline" className="recorder-panel__timecode font-mono text-xs px-2 py-0.5" data-timecode>
          {formatTimecode(snap.recordedTimeMs)}
        </Badge>
      </CardHeader>

      <CardContent className="p-3 pt-0 flex flex-col gap-3">
        <div className="recorder-panel__controls flex gap-2 flex-wrap items-center">
          <Button
            type="button"
            variant={snap.state === 'recording' ? 'panic' : 'outline'}
            size="sm"
            className={`btn-transport btn-record ${snap.state === 'recording' ? 'active' : ''}`}
            onClick={handleRecordToggle}
            aria-label={snap.state === 'recording' ? 'Stop Recording' : 'Record'}
            data-btn-record
          >
            <span className="rec-dot inline-block w-2 h-2 rounded-full bg-red-500 mr-1 animate-pulse" />
            {snap.state === 'recording' ? 'Rec...' : 'Record'}
          </Button>

          <Button
            type="button"
            variant={snap.state === 'playing' ? 'on' : 'outline'}
            size="sm"
            className={`btn-transport btn-play ${snap.state === 'playing' ? 'active' : ''}`}
            onClick={handlePlayToggle}
            disabled={snap.eventCount === 0 || snap.state === 'recording'}
            aria-label={snap.state === 'playing' ? 'Pause Playback' : 'Play'}
            data-btn-play
          >
            ▶ {snap.state === 'playing' ? 'Playing' : 'Play'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="btn-transport btn-stop"
            onClick={handleStop}
            disabled={snap.state === 'idle'}
            aria-label="Stop Transport"
            data-btn-stop
          >
            ■ Stop
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="btn-transport btn-clear"
            onClick={handleClear}
            disabled={snap.eventCount === 0}
            aria-label="Clear Recorded Events"
            data-btn-clear
          >
            Clear ({snap.eventCount})
          </Button>
        </div>

        <div className="recorder-panel__export flex gap-2 flex-wrap items-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="btn-export btn-export-midi text-xs"
            onClick={handleExportMidi}
            disabled={snap.eventCount === 0}
            data-export-midi
          >
            Export MIDI (.mid)
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="btn-export btn-export-wav text-xs"
            onClick={handleExportWav}
            disabled={snap.eventCount === 0}
            data-export-wav
          >
            Export Audio (.wav)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
