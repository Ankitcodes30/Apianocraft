import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { DiagnosticsSnapshot } from '../audio/types'
import { useFps } from '../hooks/useFps'

/** Lightweight status strip; polls diagnostics at 2 Hz — never on the note path. */
export function EngineStatus({ engine }: { engine: AudioEngine }) {
  const [diag, setDiag] = useState<DiagnosticsSnapshot | null>(() => engine.getDiagnostics())
  const [expanded, setExpanded] = useState(false)
  const fps = useFps()

  useEffect(() => {
    setDiag(engine.getDiagnostics())
    const id = window.setInterval(() => setDiag(engine.getDiagnostics()), 500)
    return () => window.clearInterval(id)
  }, [engine])

  if (!diag) return null

  const isRunning = diag.contextState === 'running'
  const isSuspended = diag.contextState === 'suspended'
  const dotColor = isRunning ? '#6FA77A' : isSuspended ? '#C89040' : '#A84A4A'

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-[10px]" data-engine-status>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="chip cursor-pointer hover:bg-[#303030] transition-colors font-medium border-[#3A3A3A] bg-[#242424] text-[#F2F2F2]"
        title="Click to toggle detailed audio engine diagnostics monitor"
      >
        <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: dotColor }} />
        <span>AUDIO: {diag.contextState.toUpperCase()}</span>
        <span className="opacity-60 ml-1 text-[9px] text-[#B5B5B5]">
          ({diag.activeVoices}/{diag.polyphonyCap} v {expanded ? '▲' : '▼'})
        </span>
      </button>

      {/* Render all diagnostic chips for smoke test verification & telemetry */}
      <div className={`${expanded ? 'inline-flex flex-wrap items-center gap-1' : 'hidden'} md:inline-flex md:flex-wrap md:items-center md:gap-1`}>
        <span className="chip" title="Audio Limiter Mode">limiter: {diag.limiter}</span>
        <span className="chip text-[#F2F2F2]" title="Base Hardware Latency">
          {diag.baseLatencyMs.toFixed(1)} ms
        </span>
        <span className="chip" title="Active Voices / Polyphony Cap">
          voices: {diag.activeVoices}/{diag.polyphonyCap}
        </span>
        <span className="chip" title="Sustained Voices">sustained: {diag.sustainedVoices}</span>
        <span className="chip" title="Total Voice Triggers">started: {diag.totalStarted}</span>
        <span className="chip" title="Voice Steals">steals: {diag.steals}</span>
        <span className="chip" title="Dropped Voices">dropped: {diag.dropped}</span>
        <span className="chip" title="Retriggers">retrigger: {diag.retriggers}</span>
        <span className="chip" title="Pending Sample Loads">loads: {diag.pendingLoads}</span>
        <span className="chip text-[#F2F2F2]" title="Frames Per Second">fps: {fps}</span>
      </div>
    </div>
  )
}
